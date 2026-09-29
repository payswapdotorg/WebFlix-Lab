/**
 * Unified artifact manifest registry — CLI entry (WFLX-P3B wave 1).
 *
 * Usage:
 *   bun run tools/manifest/build-registry.ts [--out <file>] [--now <iso-utc>]
 *        [--audio-dir <dir>] [--video-dir <dir>] [--fixtures-dir <dir>] [--quiet]
 *
 * Defaults: --out artifacts/manifest/registry.json, roots artifacts/audio and
 * artifacts/video, fixtures fixtures/contracts. Without --now the registry is
 * stamped with the wall clock and marked generatedAtSource 'wall-clock'
 * (run-specific); pass --now for a byte-reproducible registry.
 *
 * Exits non-zero when the store fails validation (artifact guard, kind/surface
 * mismatch, media hash mismatch) — the registry is the provenance spine and
 * never silently absorbs an inconsistent store.
 *
 * This module is imported by tests/integration/manifest-registry.test.ts so it
 * stays inside the `bun run typecheck` program (tsconfig include covers
 * src/tests/experiments; tools/ enters the program through the import).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  buildUnifiedRegistry,
  ManifestError,
  MANIFEST_TOOL_ID,
  MANIFEST_TOOL_VERSION,
  serializeRegistry,
} from './registry';

export const MANIFEST_CLI_USAGE =
  'bun run tools/manifest/build-registry.ts [--out <file>] [--now <iso-utc>] ' +
  '[--audio-dir <dir>] [--video-dir <dir>] [--fixtures-dir <dir>] [--quiet]';

interface CliArgs {
  out: string;
  now: string | undefined;
  audioRoot: string | undefined;
  videoRoot: string | undefined;
  fixtureRoot: string | undefined;
  quiet: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { out: 'artifacts/manifest/registry.json', now: undefined, audioRoot: undefined, videoRoot: undefined, fixtureRoot: undefined, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    const needValue = (name: string): string => {
      if (value === undefined) {
        throw new ManifestError(`${name} requires a value\n${MANIFEST_CLI_USAGE}`);
      }
      i += 1;
      return value;
    };
    if (flag === '--out') args.out = needValue('--out');
    else if (flag === '--now') args.now = needValue('--now');
    else if (flag === '--audio-dir') args.audioRoot = needValue('--audio-dir');
    else if (flag === '--video-dir') args.videoRoot = needValue('--video-dir');
    else if (flag === '--fixtures-dir') args.fixtureRoot = needValue('--fixtures-dir');
    else if (flag === '--quiet') args.quiet = true;
    else throw new ManifestError(`unknown flag ${flag}\n${MANIFEST_CLI_USAGE}`);
  }
  return args;
}

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  const wallClock = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const now = args.now ?? wallClock;
  const generatedAtSource = args.now !== undefined ? ('flag' as const) : ('wall-clock' as const);

  try {
    const registry = buildUnifiedRegistry({
      now,
      generatedAtSource,
      ...(args.audioRoot !== undefined ? { audioRoot: args.audioRoot } : {}),
      ...(args.videoRoot !== undefined ? { videoRoot: args.videoRoot } : {}),
      ...(args.fixtureRoot !== undefined ? { fixtureRoot: args.fixtureRoot } : {}),
    });
    const serialized = serializeRegistry(registry);
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, serialized);

    if (!args.quiet) {
      const verified = registry.records.filter((r) => r.media.sha256Match === true).length;
      const fingerprinted = registry.records.filter((r) => !r.media.present).length;
      console.log(`${MANIFEST_TOOL_ID}@${MANIFEST_TOOL_VERSION}: wrote ${args.out}`);
      console.log(
        `records: ${registry.counts.total} (${registry.counts.audio} audio / ${registry.counts.video} video) ` +
          `| media verified on disk: ${verified} | fingerprint-only: ${fingerprinted}`,
      );
      console.log(
        `contracts ${registry.metadata.contractsVersion} | styleBible ${registry.metadata.styleBibleVersion} ` +
          `| tools ${registry.metadata.toolVersions.manifestTool}, bun ${registry.metadata.toolVersions.bun}`,
      );
      if (generatedAtSource === 'wall-clock') {
        console.log('generatedAt: wall-clock (run-specific) — pass --now for byte-reproducible output');
      }
    }
    return 0;
  } catch (error) {
    if (error instanceof ManifestError) {
      console.error(`${MANIFEST_TOOL_ID}: ${error.message}`);
      return 1;
    }
    throw error;
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
