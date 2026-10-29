// Tiny static server for previewing dist/ locally, honoring basePath from site.config.json.
// With --watch (npm run dev): rebuilds when entries, src/, tools/, the config or .cache/ change, and reloads open pages.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, loadConfig } from './lib.mjs';

const DIST = path.join(ROOT, 'dist');
const base = (loadConfig().basePath || '').replace(/\/+$/, '');
const port = Number(process.env.PORT) || 8080;
const watch = process.argv.includes('--watch');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.xml': 'application/xml' };

// live reload: pages keep an EventSource open and reload when a rebuild finishes
const clients = new Set();
const RELOAD = '/__reload';
const reloadScript = Buffer.from(`<script>new EventSource('${RELOAD}').onmessage=()=>location.reload()</script>`);

http
  .createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (watch && p === RELOAD) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      res.write(': connected\n\n');
      clients.add(res);
      return req.on('close', () => clients.delete(res));
    }
    if (base && p === '/') return res.writeHead(302, { Location: `${base}/` }).end();
    if (base && p.startsWith(base)) p = p.slice(base.length) || '/';
    let file = path.join(DIST, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (file.endsWith(path.sep) || (fs.existsSync(file) && fs.statSync(file).isDirectory())) file = path.join(file, 'index.html');
    let status = 200;
    if (!file.startsWith(DIST) || !fs.existsSync(file)) {
      status = 404;
      file = path.join(DIST, '404.html');
      if (!fs.existsSync(file)) return res.writeHead(404, { 'Content-Type': types['.html'] }).end('not found');
    }
    const type = types[path.extname(file)] || 'application/octet-stream';
    res.writeHead(status, { 'Content-Type': type, ...(watch ? { 'Cache-Control': 'no-store' } : {}) });
    if (watch && path.extname(file) === '.html') {
      const html = fs.readFileSync(file);
      const at = html.lastIndexOf('</body>');
      return res.end(at < 0 ? html : Buffer.concat([html.subarray(0, at), reloadScript, html.subarray(at)]));
    }
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`→ http://localhost:${port}${base}/${watch ? ' (watching for changes)' : ''}`));

if (watch) {
  // build.mjs runs in a fresh process each time, so edits to the build itself are picked up too
  let timer = null;
  let building = false;
  let again = false;
  const rebuild = () => {
    if (building) return void (again = true);
    building = true;
    const t = Date.now();
    spawn(process.execPath, [path.join(ROOT, 'tools', 'build.mjs')], { cwd: ROOT, stdio: 'inherit' }).on('exit', (code) => {
      building = false;
      if (code === 0) {
        console.log(`  rebuilt in ${Date.now() - t}ms, reloading ${clients.size} page(s)`);
        for (const c of clients) c.write('data: reload\n\n');
      }
      if (again) {
        again = false;
        rebuild();
      }
    });
  };
  // .cache/ only for its JSON files: enrich writes those once at the end, but READMEs one by one
  const paths = { scripts: true, src: true, tools: true, '.cache': false, 'site.config.json': false };
  for (const [p, recursive] of Object.entries(paths)) {
    const full = path.join(ROOT, p);
    if (!fs.existsSync(full)) continue;
    fs.watch(full, { recursive }, (_, name) => {
      if (p === '.cache' && !name?.endsWith('.json')) return;
      if (!timer) console.log(`  changed: ${path.join(p, name || '').replace(/\\/g, '/')}`);
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        rebuild();
      }, 150);
    });
  }
}
