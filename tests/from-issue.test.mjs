import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseFrontMatter } from '../tools/lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const confirmations = `- [x] I'm the author, or I have the author's OK to list it
- [x] It runs on real hardware and does what the entry says
- [x] I understand the code well enough to answer questions and fix bugs`;
const imported = `---
name: Example
platform: norns
repo: https://github.com/owner/Example
author: Original
description: Old description
tags: [old]
requires: [grid]
ai: unknown
source: imported
origin: github-topic:norns
listing: indexed
docs: https://example.com/docs
invited: https://example.com/invite
---
Catalog notes.
`;

function fixture(t, entry = imported) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'splines-issue-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  for (const file of ['lib.mjs', 'from-issue.mjs']) fs.copyFileSync(path.join(root, 'tools', file), path.join(dir, 'tools', file));
  fs.cpSync(path.join(root, 'node_modules', 'yaml'), path.join(dir, 'node_modules', 'yaml'), { recursive: true });
  if (entry) {
    fs.mkdirSync(path.join(dir, 'scripts', 'Example'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'scripts', 'Example', 'index.md'), entry);
  }
  fs.writeFileSync(path.join(dir, 'mock.mjs'), `
globalThis.fetch = async (url) => {
  if (url.endsWith('/contents/lib/mod.lua')) return new Response('', { status: 404 });
  return Response.json({ name: 'Example', html_url: 'https://github.com/owner/Example', owner: { login: 'owner' }, license: { spdx_id: 'MIT' } });
};
`);
  return dir;
}

function run(dir, overrides = {}, env = {}) {
  const fields = {
    Repository: 'https://github.com/OWNER/Example.git/',
    Platform: 'norns',
    Description: 'New description',
    Tags: 'generative, ambient',
    'Hardware it needs': '- [ ] grid\n- [ ] midi',
    'AI disclosure': 'assisted: made with meaningful help',
    Name: '_No response_',
    Author: '_No response_',
    License: '_No response_',
    Discussion: '_No response_',
    'The one rule': confirmations,
    ...overrides,
  };
  const body = Object.entries(fields).map(([label, value]) => `### ${label}\n\n${value}`).join('\n\n');
  const result = spawnSync(process.execPath, ['--import', pathToFileURL(path.join(dir, 'mock.mjs')).href, path.join(dir, 'tools', 'from-issue.mjs')], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_OUTPUT: '', ISSUE_TITLE: '[submit] Example', ISSUE_BODY: body, ISSUE_NUMBER: '42', ISSUE_AUTHOR: 'owner', ISSUE_SUBMISSION: '', ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

test('submission updates an imported entry and preserves fields not supplied', (t) => {
  const dir = fixture(t);
  const result = run(dir);
  assert.match(result.stdout, /file=scripts\/Example\/index\.md/);
  const { data, body } = parseFrontMatter(fs.readFileSync(path.join(dir, 'scripts', 'Example', 'index.md'), 'utf8'));
  assert.equal(data.description, 'New description');
  assert.deepEqual(data.tags, ['generative', 'ambient']);
  assert.equal(data.requires, undefined);
  assert.equal(data.ai, 'assisted');
  assert.equal(data.listing, 'published');
  assert.equal(data.source, 'submitted');
  assert.equal(data.origin, undefined);
  assert.match(data.added, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(data.author, 'Original');
  assert.equal(data.docs, 'https://example.com/docs');
  assert.equal(data.invited, 'https://example.com/invite');
  assert.match(body, /Catalog notes/);
  assert.match(fs.readFileSync(path.join(dir, 'pr-body.md'), 'utf8'), /Updates \*\*Example\*\*/);
});

test('submission creates a published entry and uses the submission label if the title changed', (t) => {
  const dir = fixture(t, null);
  run(dir, { Author: 'A musician', License: 'GPL-3.0', Discussion: 'https://example.com/thread', 'Hardware it needs': '- [x] midi' }, { ISSUE_TITLE: 'Example', ISSUE_SUBMISSION: 'true' });
  const { data } = parseFrontMatter(fs.readFileSync(path.join(dir, 'scripts', 'Example', 'index.md'), 'utf8'));
  assert.equal(data.repo, 'https://github.com/owner/Example');
  assert.equal(data.author, 'A musician');
  assert.equal(data.license, 'GPL-3.0');
  assert.equal(data.discussion, 'https://example.com/thread');
  assert.deepEqual(data.requires, ['midi']);
  assert.equal(data.listing, 'published');
  assert.equal(data.ai, 'assisted');
});

test('existing entry accepts optional submitted fields without overwriting omitted ones', (t) => {
  const dir = fixture(t);
  run(dir, { Author: 'New author', License: 'MIT', Discussion: 'https://example.com/thread', 'Hardware it needs': '- [x] midi' });
  const { data } = parseFrontMatter(fs.readFileSync(path.join(dir, 'scripts', 'Example', 'index.md'), 'utf8'));
  assert.equal(data.author, 'New author');
  assert.equal(data.license, 'MIT');
  assert.equal(data.discussion, 'https://example.com/thread');
  assert.deepEqual(data.requires, ['midi']);
  assert.equal(data.docs, 'https://example.com/docs');
});

test('submission rejects missing consent, conflicting names and invalid links without changing the entry', (t) => {
  for (const [overrides, error] of [
    [{ 'The one rule': '- [ ] not confirmed' }, /confirm all three/],
    [{ Name: 'Different' }, /already listed/],
    [{ Discussion: 'http://example.com' }, /discussion must be an https link/],
  ]) {
    const dir = fixture(t);
    run(dir, overrides);
    assert.equal(fs.readFileSync(path.join(dir, 'scripts', 'Example', 'index.md'), 'utf8'), imported);
    assert.match(fs.readFileSync(path.join(dir, 'comment.md'), 'utf8'), error);
  }
});

test('a different platform does not overwrite the existing entry', (t) => {
  const dir = fixture(t);
  run(dir, { Platform: 'crow', Name: 'Example-crow' });
  assert.equal(fs.readFileSync(path.join(dir, 'scripts', 'Example', 'index.md'), 'utf8'), imported);
  const { data } = parseFrontMatter(fs.readFileSync(path.join(dir, 'scripts', 'Example-crow', 'index.md'), 'utf8'));
  assert.equal(data.platform, 'crow');
});

test('a matching published entry reports that there is nothing to update', (t) => {
  const entry = imported
    .replace('description: Old description', 'description: New description')
    .replace('tags: [old]', 'tags: [generative, ambient]')
    .replace('requires: [grid]\n', '')
    .replace('ai: unknown', 'ai: assisted')
    .replace('source: imported', 'source: submitted')
    .replace('origin: github-topic:norns\n', '')
    .replace('listing: indexed', 'listing: published\nadded: 2026-01-01');
  const dir = fixture(t, entry);
  run(dir);
  assert.equal(fs.readFileSync(path.join(dir, 'scripts', 'Example', 'index.md'), 'utf8'), entry);
  assert.match(fs.readFileSync(path.join(dir, 'comment.md'), 'utf8'), /nothing to change/);
});
