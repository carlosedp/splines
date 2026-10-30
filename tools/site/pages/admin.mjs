// admin/: where maintainers sign in. With a GitHub token from someone who can write to the catalog repo, the home
// page shows every entry (indexed and declined ones too) plus a listing filter: admin.js loads the unpublished entries
// from the GitHub API and adds their cards. The deployed site never contains them. Not linked, not in the sitemap.
import { html } from "../html.mjs";
import { cfg, href } from "../context.mjs";
import { layout } from "../layout.mjs";

export default function admin(records, write) {
  write(
    "admin/index.html",
    layout({
      title: "admin",
      noindex: true,
      body: html`
<section class="hero">
  <h1>admin</h1>
  <p>Maintainers (anyone with write access to <a href="https://github.com/${cfg.repo}">${cfg.repo}</a>) can sign in here to see every entry on the <a href="${href("")}">catalog page</a>, including the ones that aren't published, with a filter by listing.</p>
</section>
<div id="admin" data-repo="${cfg.repo}" data-branch="${cfg.branch}" data-home="${href("")}">
  <form class="admin-signin" hidden>
    <label for="admin-token">GitHub token</label>
    <div class="copy-row"><input id="admin-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"><button type="submit">sign in</button></div>
    <p class="hint">A <a href="https://github.com/settings/personal-access-tokens/new">fine-grained token</a> with public repository read access is enough. It stays in this browser and is only sent to api.github.com.</p>
  </form>
  <p class="admin-status hint" role="status"></p>
  <p class="admin-actions" hidden><a href="${href("")}">go to the catalog →</a> <button type="button" class="link-button admin-signout">sign out</button></p>
</div>
<script src="${href("assets/admin.js")}" defer></script>
`,
    }),
  );
}
