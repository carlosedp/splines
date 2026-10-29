// Writing dist/ in place: files whose content didn't change aren't rewritten, and prune() removes whatever this
// build didn't write (deleted or renamed entries). On Windows, rewriting ~600 directories (and having them
// scanned) used to be most of the build time; rendering itself takes about a second.
import fs from "node:fs";
import path from "node:path";

export function createOutput(dist) {
  const written = new Set();
  const madeDirs = new Set();

  const write = (rel, content) => {
    const f = path.join(dist, rel);
    written.add(f);
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
    try {
      if (fs.readFileSync(f).equals(buf)) return;
    } catch {
      /* new file */
    }
    const dir = path.dirname(f);
    if (!madeDirs.has(dir)) fs.mkdirSync(dir, { recursive: true });
    madeDirs.add(dir);
    fs.writeFileSync(f, buf);
  };

  const copyDir = (from, to) => {
    for (const d of fs.readdirSync(from, { withFileTypes: true })) {
      const rel = path.join(to, d.name);
      if (d.isDirectory()) copyDir(path.join(from, d.name), rel);
      else write(rel, fs.readFileSync(path.join(from, d.name)));
    }
  };

  const prune = (dir = dist) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, d.name);
      if (d.isDirectory()) {
        prune(f);
        if (!fs.readdirSync(f).length) fs.rmdirSync(f);
      } else if (!written.has(f)) fs.rmSync(f);
    }
  };

  return { write, copyDir, prune };
}
