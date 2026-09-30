/**
 * Unified artifact manifest registry test (WFLX-P3B wave 1 — Phase 3
 * checklist §2 items 2 + 3).
 *
 * Verifies the tools/manifest registry builder against the REAL committed
 * artifact store (artifacts/audio/** + artifacts/video/**):
 *   - coverage: every artifact.json under both roots becomes a record;
 *   - record shape: schema-validated GeneratedArtifact + sidecar hashes +
 *     media integrity (on-disk sha256 must match the sidecar fingerprint);
 *   - reproducibility metadata (item 3): seeds (artifact + resolved plan
 *     Director seed), CONTRACTS_VERSION, StyleBible version, provider
 *     identities, tool versions on every registry the tool emits;
 *   - the C-9 emission (v2 contract wave): video artifact.json files now
 *     CARRY styleBibleVersion (src/video/artifacts.ts references
 *     STYLE_BIBLE_VERSION since 2.0.0) — this wave-1 gap-pin test FLIPPED
 *     from pinning the DOCUMENTED gap to asserting PRESENCE, and the
 *     registry prefers the emitted value (const fallback only for
 *     pre-v2 records);
 *   - determinism: two builds over the same store + same --now are
 *     byte-identical; the CLI writes the same bytes as the in-process build.
 *
 * Lab reproduction evidence only — NOT product-parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { CONTRACTS_VERSION, GeneratedArtifactSchema } from '../../src/contracts';
import { STYLE_BIBLE_VERSION } from '../../src/video/style-bible';
import {
  buildUnifiedRegistry,
  MANIFEST_TOOL_VERSION,
  REGISTRY_RECORD_TYPE,
  serializeRegistry,
  type RegistryRecord,
} from '../../tools/manifest/registry';
// Keeps the CLI module inside the typecheck program (tsconfig include does
// not list tools/**; the import pulls it into the tsc program).
import { MANIFEST_CLI_USAGE } from '../../tools/manifest/build-registry';
import { REGISTRY_NOW } from './fixtures';

const AUDIO_ROOT = 'artifacts/audio';
const VIDEO_ROOT = 'artifacts/video';

const sha256 = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

function findArtifactJsonDirs(root: string): string[] {
  const found: string[] = [];
  if (!existsSync(root)) return found;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = join(dir, entry.name);
      if (existsSync(join(child, 'artifact.json'))) found.push(child);
      else walk(child);
    }
  };
  walk(root);
  return found;
}

function recordByDirectory(records: readonly RegistryRecord[], directory: string): RegistryRecord {
  const hit = records.find((r) => r.directory === directory);
  if (hit === undefined) {
    throw new Error(`registry is missing the expected record ${directory}`);
  }
  return hit;
}

describe('unified artifact manifest registry (Phase 3 checklist §2 items 2+3)', () => {
  test('covers every artifact.json under both surfaces and validates every record', () => {
    const registry = buildUnifiedRegistry({ now: REGISTRY_NOW });

    // Coverage: the registry is exactly the store's GeneratedArtifact set.
    const audioDirs = findArtifactJsonDirs(AUDIO_ROOT);
    const videoDirs = findArtifactJsonDirs(VIDEO_ROOT);
    expect(registry.counts.audio).toBe(audioDirs.length);
    expect(registry.counts.video).toBe(videoDirs.length);
    expect(registry.counts.total).toBe(audioDirs.length + videoDirs.length);
    expect(registry.records.length).toBe(registry.counts.total);
    // Minimums pinning today's committed store (11 audio runs, 2 video runs).
    expect(registry.counts.audio).toBeGreaterThanOrEqual(11);
    expect(registry.counts.video).toBeGreaterThanOrEqual(2);

    for (const record of registry.records) {
      // The inlined artifact is the frozen contract record, re-validated here.
      expect(GeneratedArtifactSchema.safeParse(record.artifact).success).toBe(true);
      expect(record.artifact.kind).toBe(record.surface === 'audio' ? 'audio-overview' : 'video-overview');
      // Reproducibility metadata on every record.
      expect(record.seeds.artifactSeed).toBeTruthy();
      expect(record.providerIdentities.length).toBeGreaterThan(0);
      expect(record.providerIdentities).toEqual(
        record.artifact.providers.map((p) => `${p.stage}=${p.provider}${p.model !== undefined ? `@${p.model}` : ''}`),
      );
      expect(record.artifact.contractVersion).toBe(CONTRACTS_VERSION);
      // Registry/store drift check: artifact.json hash matches the store.
      expect(record.artifactJsonSha256).toBe(sha256(join(record.directory, 'artifact.json')));
      // Sidecars are hashed and sorted.
      const names = record.sidecars.map((s) => s.file);
      expect([...names].sort()).toEqual(names);
      for (const sidecar of record.sidecars) {
        expect(sidecar.sha256).toBe(sha256(join(record.directory, sidecar.file)));
      }
      // Media integrity is either verified on disk or fingerprint-only.
      if (record.media.present) {
        expect(record.media.sha256Match).toBe(true);
        expect(sha256(join(record.directory, record.media.file))).toBe(record.artifact.media.sha256);
      } else {
        expect(record.media.sha256Match).toBeNull();
      }
    }
  });

  test('registry metadata carries the full reproducibility set (item 3)', () => {
    const registry = buildUnifiedRegistry({ now: REGISTRY_NOW });
    const meta = registry.metadata;

    expect(registry.recordType).toBe(REGISTRY_RECORD_TYPE);
    expect(registry.generatedAt).toBe(REGISTRY_NOW);
    expect(registry.generatedAtSource).toBe('flag');
    expect(meta.contractsVersion).toBe(CONTRACTS_VERSION);
    expect(meta.styleBibleVersion).toBe(STYLE_BIBLE_VERSION);
    // C-9 landed (v2): the source note describes the EMISSION, not a gap.
    expect(meta.styleBibleVersionSource).toContain('emitted');
    expect(meta.styleBibleVersionSource).toContain('C-9');
    expect(meta.styleBibleVersionSource).not.toContain('DOCUMENTED GAP');
    // Tool versions.
    expect(meta.toolVersions.manifestTool).toContain(`@${MANIFEST_TOOL_VERSION}`);
    expect(meta.toolVersions.bun).toBeTruthy();
    expect(meta.toolVersions.zod).toBeTruthy();
    expect(meta.toolVersions.typescript).toBeTruthy();
    // Run-specific wall-clock logs are hashed, never inlined.
    expect(meta.surfaceLogs.some((s) => s.file === join(AUDIO_ROOT, 'benchmark-run.json'))).toBe(true);
    expect(meta.surfaceLogs.some((s) => s.file === join(VIDEO_ROOT, 'benchmark-run.json'))).toBe(true);
    expect(meta.notes.some((n) => n.includes('NOT product parity evidence'))).toBe(true);
  });

  test('seed chain and plan resolution per surface convention', () => {
    const registry = buildUnifiedRegistry({ now: REGISTRY_NOW });

    // Canonical audio run: plan resolved from the frozen W1 fixture.
    const canonicalAudio = recordByDirectory(registry.records, join(AUDIO_ROOT, 'canonical-deep-dive-5min'));
    expect(canonicalAudio.plan.source).toBe('fixture');
    expect(canonicalAudio.plan.file).toBe('fixtures/contracts/plan-audio-deep-dive-5min.json');
    expect(canonicalAudio.seeds.planSeed).toBe('wflx-canonical-audio-deep-dive-5min');
    expect(canonicalAudio.seeds.artifactSeed).toBe('wflx-w2-audio-test-seed');
    expect(canonicalAudio.media.present).toBe(false); // fingerprint-only convention

    // EXP-A arm: plan resolved from the plan.json provenance sidecar.
    const expArm = recordByDirectory(registry.records, join(AUDIO_ROOT, 'exp-a/deepdive-5min-baseline'));
    expect(expArm.plan.source).toBe('sidecar');
    expect(expArm.seeds.planSeed).toBe('wflx-exp-a-director-seed');
    expect(expArm.sidecars.map((s) => s.file)).toContain('plan.json');

    // Canonical video run: plan resolved from the frozen W1 fixture.
    const canonicalVideo = recordByDirectory(registry.records, join(VIDEO_ROOT, 'canonical-explainer-7min'));
    expect(canonicalVideo.plan.source).toBe('fixture');
    expect(canonicalVideo.plan.file).toBe('fixtures/contracts/plan-video-explainer-7min.json');
    expect(canonicalVideo.seeds.planSeed).toBe('wflx-canonical-video-explainer-7min');

    // Committed benchmark media verifies on disk (integrity proof).
    const benchmarkAudio = recordByDirectory(registry.records, join(AUDIO_ROOT, 'benchmark-deep-dive-42s'));
    expect(benchmarkAudio.media.present).toBe(true);
    expect(benchmarkAudio.media.sha256Match).toBe(true);
    const benchmarkVideo = recordByDirectory(registry.records, join(VIDEO_ROOT, 'benchmark-explainer-26s'));
    expect(benchmarkVideo.media.present).toBe(true);
    expect(benchmarkVideo.media.sha256Match).toBe(true);
  });

  test('C-9 FLIPPED (v2): video manifests now EMIT styleBibleVersion; the registry prefers the emitted value', () => {
    const registry = buildUnifiedRegistry({ now: REGISTRY_NOW });

    for (const record of registry.records.filter((r) => r.surface === 'video')) {
      // The video surface's own manifest now carries the field (PRESENCE —
      // the p3b wave-1 gap-pin flipped at the C-9 landing)...
      const raw = JSON.parse(readFileSync(join(record.directory, 'artifact.json'), 'utf8')) as {
        styleBibleVersion?: string;
      };
      expect(raw.styleBibleVersion).toBe(STYLE_BIBLE_VERSION);
      expect(record.artifact.styleBibleVersion).toBe(STYLE_BIBLE_VERSION);
      // ...and the registry record prefers that emitted value.
      expect(record.styleBibleVersion).toBe(raw.styleBibleVersion ?? STYLE_BIBLE_VERSION);
      expect(record.styleBibleVersion).toBe(STYLE_BIBLE_VERSION);
    }
    // StyleBible is a video-surface concept; audio records carry null.
    for (const record of registry.records.filter((r) => r.surface === 'audio')) {
      expect(record.styleBibleVersion).toBeNull();
    }
  });

  test('deterministic build: same store + same now -> byte-identical registry', () => {
    const a = buildUnifiedRegistry({ now: REGISTRY_NOW });
    const b = buildUnifiedRegistry({ now: REGISTRY_NOW });
    expect(serializeRegistry(a)).toBe(serializeRegistry(b));
  });

  test('CLI wiring: package script exists and the CLI emits the same bytes as the core builder', async () => {
    // package.json script entry (owned addition).
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['manifest:build']).toBe('bun run tools/manifest/build-registry.ts');
    expect(MANIFEST_CLI_USAGE).toContain('build-registry.ts');

    const workDir = mkdtempSync(join(tmpdir(), 'wflx-p3b-manifest-'));
    try {
      const out = join(workDir, 'registry.json');
      const proc = Bun.spawn([
        'bun',
        'run',
        'tools/manifest/build-registry.ts',
        '--out',
        out,
        '--now',
        REGISTRY_NOW,
        '--quiet',
      ]);
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
      expect(existsSync(out)).toBe(true);

      // CLI bytes === core-builder bytes over the same store + now.
      const cliBytes = readFileSync(out, 'utf8');
      const core = buildUnifiedRegistry({ now: REGISTRY_NOW });
      expect(cliBytes).toBe(serializeRegistry(core));
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }, 60_000);
});
