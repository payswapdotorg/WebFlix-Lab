/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — static client serving.
 *
 * The client is ZERO-BUILD: plain HTML + CSS + vanilla TypeScript. The
 * browser fetches `/app.js`, which this module produces by type-stripping
 * web/app.ts with Bun's transpiler AT REQUEST TIME (no bundler, no build
 * step, no npm dependency; the source file itself stays root-tsc-checked).
 * Only the three fixed routes below are served — no filesystem routing, no
 * traversal surface.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { errorResponse } from './errors';

const WEB_DIR = join(import.meta.dir, '..', 'web');

const INDEX_HTML = join(WEB_DIR, 'index.html');
const APP_TS = join(WEB_DIR, 'app.ts');
const STYLES_CSS = join(WEB_DIR, 'styles.css');

const transpiler = new Bun.Transpiler({ loader: 'ts' });

function textResponse(body: string, contentType: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
    },
  });
}

export function handleIndex(): Response {
  try {
    return textResponse(readFileSync(INDEX_HTML, 'utf8'), 'text/html; charset=utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(500, 'static-missing', `index.html unavailable: ${message}`);
  }
}

export function handleAppJs(): Response {
  try {
    const source = readFileSync(APP_TS, 'utf8');
    const js = transpiler.transformSync(source);
    return textResponse(js, 'text/javascript; charset=utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(500, 'static-missing', `app.ts unavailable: ${message}`);
  }
}

export function handleStyles(): Response {
  try {
    return textResponse(readFileSync(STYLES_CSS, 'utf8'), 'text/css; charset=utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(500, 'static-missing', `styles.css unavailable: ${message}`);
  }
}
