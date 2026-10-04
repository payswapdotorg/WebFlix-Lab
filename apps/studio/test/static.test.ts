/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — zero-build static client serving.
 *
 * / serves index.html; /app.js is web/app.ts type-stripped at request time
 * (Bun.Transpiler — no bundler, no build step); /styles.css is the
 * stylesheet. The transpiled client must carry NO type-only imports.
 */

import { describe, expect, test } from 'bun:test';
import { bootStudio } from './helpers';

describe('static client surface', () => {
  test('GET / serves the studio HTML shell', async () => {
    const studio = bootStudio();
    try {
      const response = await fetch(`${studio.baseUrl}/`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      const html = await response.text();
      expect(html).toContain('Operator Studio');
      expect(html).toContain('WebFlix-Lab research implementation');
      expect(html).toContain('UNRESOLVED'); // honest microphone boundary in the footer
      expect(html).toContain('<script type="module" src="/app.js">');
    } finally {
      await studio.stop();
    }
  });

  test('GET /app.js serves the type-stripped client (no TS-only syntax remains)', async () => {
    const studio = bootStudio();
    try {
      const response = await fetch(`${studio.baseUrl}/app.js`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/javascript');
      const js = await response.text();
      expect(js).toContain('fetchJson');
      expect(js).not.toContain('import type');
      expect(js).not.toContain(': DomElement'); // annotations stripped
      expect(js).not.toContain('interface ');
    } finally {
      await studio.stop();
    }
  });

  test('GET /styles.css serves the dark lab stylesheet', async () => {
    const studio = bootStudio();
    try {
      const response = await fetch(`${studio.baseUrl}/styles.css`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/css');
      const css = await response.text();
      expect(css).toContain('--accent');
    } finally {
      await studio.stop();
    }
  });

  test('unknown non-API paths 404 with a typed body', async () => {
    const studio = bootStudio();
    try {
      const response = await fetch(`${studio.baseUrl}/nope`);
      expect(response.status).toBe(404);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('not-found');
    } finally {
      await studio.stop();
    }
  });
});
