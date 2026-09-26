/**
 * PublicArticleAdapter tests: URL fetch + readable-text extraction against a
 * local fixture server (fully offline). Documented limitations are tested as
 * error paths: JS-rendered/short pages, login/paywall gates, non-HTML
 * content types, non-http schemes.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { PublicArticleAdapter } from '../../src/source/public-article-adapter';
import { AdapterError } from '../../src/source/adapter';
import { validateSourceArtifact } from '../../src/contracts';

const ARTICLE_HTML = `<!doctype html>
<html>
<head>
  <title>Orchestrating Agents, a Field Guide</title>
  <meta property="og:title" content="Orchestrating Agents, a Field Guide (og)" />
  <script>window.__data = "never extracted";</script>
  <style>body { color: red; }</style>
</head>
<body>
  <nav><a href="/">home</a> <a href="/about">about</a></nav>
  <header>site header noise</header>
  <article>
    <h1>Orchestrating Agents, a Field Guide</h1>
    <p>Multi-agent orchestration needs three things: tools, audits and resource limits.</p>
    <h2>The stack</h2>
    <p>The reference stack pairs Postgres/Neon for state and Vercel/GitHub for deploys.</p>
    <ul>
      <li>agent tool systems</li>
      <li>security/integrity audits</li>
      <li>sandbox/resource limits</li>
    </ul>
    <p>Closing thought: keep execution workflows observable end to end.</p>
  </article>
  <footer>footer noise and copyright</footer>
</body>
</html>`;

const LOGIN_WALL_HTML = `<!doctype html>
<html><head><title>Premium Analysis</title></head>
<body><h1>Sign in</h1><p>Please log in to continue reading this premium article.</p></body></html>`;

const EMPTY_JS_APP_HTML = `<!doctype html>
<html><head><title>SPA</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === '/article') {
        return new Response(ARTICLE_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      if (path === '/login-wall') {
        return new Response(LOGIN_WALL_HTML, { headers: { 'content-type': 'text/html' } });
      }
      if (path === '/spa') {
        return new Response(EMPTY_JS_APP_HTML, { headers: { 'content-type': 'text/html' } });
      }
      if (path === '/json') {
        return new Response('{"nope": true}', { headers: { 'content-type': 'application/json' } });
      }
      if (path === '/moved') {
        return Response.redirect(`${new URL(request.url).origin}/article`, 302);
      }
      return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
    },
  });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop(true);
});

describe('PublicArticleAdapter', () => {
  test('extracts a server-rendered article into the block grammar', async () => {
    const adapter = new PublicArticleAdapter();
    const artifact = await adapter.ingest({
      id: 'source-article-test',
      label: 'test-host',
      url: `${baseUrl}/article`,
      createdAt: '2026-09-26T00:00:00Z',
    });
    expect(artifact.title).toBe('Orchestrating Agents, a Field Guide (og)');
    expect(artifact.provenance.kind).toBe('public-article');
    expect(artifact.provenance.authorization).toBe('public');
    expect(artifact.provenance.url).toBe(`${baseUrl}/article`);
    // script/style/nav/header/footer content is stripped
    expect(artifact.text).not.toContain('never extracted');
    expect(artifact.text).not.toContain('site header noise');
    expect(artifact.text).not.toContain('footer noise');
    // structural blocks survive as the markdown-ish grammar
    const kinds = artifact.blocks.map((b) => b.kind);
    expect(kinds).toContain('heading');
    expect(kinds).toContain('list-item');
    expect(artifact.blocks.some((b) => b.text === '- agent tool systems')).toBe(true);
    expect(artifact.blocks.some((b) => b.text === '## The stack')).toBe(true);
    expect(artifact.text).toContain('Postgres/Neon');
    expect(validateSourceArtifact(artifact).valid).toBe(true);
  });

  test('follows redirects', async () => {
    const adapter = new PublicArticleAdapter();
    const artifact = await adapter.ingest({
      id: 'source-article-redirect',
      label: 'test-host',
      url: `${baseUrl}/moved`,
      createdAt: '2026-09-26T00:00:00Z',
    });
    expect(artifact.blocks.length).toBeGreaterThan(3);
  });

  test('rejects non-http schemes', async () => {
    const adapter = new PublicArticleAdapter();
    await expect(
      adapter.ingest({ id: 's', label: 'ftp', url: 'ftp://example.com/article.html' }),
    ).rejects.toThrow(AdapterError);
  });

  test('rejects HTTP errors', async () => {
    const adapter = new PublicArticleAdapter();
    await expect(
      adapter.ingest({ id: 's', label: 'test-host', url: `${baseUrl}/missing` }),
    ).rejects.toThrow(AdapterError);
  });

  test('rejects non-HTML content types', async () => {
    const adapter = new PublicArticleAdapter();
    await expect(
      adapter.ingest({ id: 's', label: 'test-host', url: `${baseUrl}/json` }),
    ).rejects.toThrow(AdapterError);
  });

  test('rejects login/paywall gates (never bypasses access controls)', async () => {
    const adapter = new PublicArticleAdapter();
    await expect(
      adapter.ingest({ id: 's', label: 'test-host', url: `${baseUrl}/login-wall` }),
    ).rejects.toThrow(/login\/paywall/);
  });

  test('rejects JavaScript-rendered shells (no headless browser)', async () => {
    const adapter = new PublicArticleAdapter();
    await expect(
      adapter.ingest({ id: 's', label: 'test-host', url: `${baseUrl}/spa` }),
    ).rejects.toThrow(/too short|JavaScript-rendered/);
  });
});
