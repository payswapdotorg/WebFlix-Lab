/**
 * Unified artifact manifest registry — core builder (WFLX-P3B wave 1;
 * Phase 3 checklist §2 items 2 + 3; work order "unify artifact manifests"
 * and "add reproducibility metadata").
 *
 * Reads BOTH surfaces' artifact stores and emits ONE registry JSON:
 *   - audio surface: every `artifact.json` (GeneratedArtifact sidecar) under
 *     the audio artifacts root (e.g. artifacts/audio/**, including the EXP-A
 *     arms) plus its provenance sidecars (plan.json / timing-manifest.json /
 *     qa-report.json — enumerated, not hard-coded);
 *   - video surface: every `artifact.json` under the video artifacts root
 *     (artifacts/video/**) plus its sidecars (qa-report.json / timeline.json
 *     / determinism.json), per the src/video/artifacts.ts output shape.
 *
 * Every registry carries reproducibility metadata (checklist §2 item 3):
 * seeds (artifact generator seed + resolved plan/Director seed),
 * CONTRACTS_VERSION, StyleBible version, provider identities and tool
 * versions.
 *
 * KNOWN GAP (DOCUMENTED in checklist §2, post-W3 audit 2026-09-28): the
 * video artifact manifests do NOT emit styleBibleVersion — the const
 * STYLE_BIBLE_VERSION exists in src/video/style-bible.ts but
 * src/video/artifacts.ts does not reference it. This tool READS that const
 * (worker-owned path, read-only) and includes it in the unified registry,
 * with the gap labeled in `metadata.styleBibleVersionSource`. The emission
 * fix itself is HANDOFF C-9 for the v2 contract wave.
 *
 * Determinism: identical store bytes + identical --now produce a
 * byte-identical registry (canonical key-sorted serialization, records
 * sorted by surface then directory, sidecars sorted by file name).
 * Additive tooling only — no contract edits, no edits under src/.
 *
 * Offline placeholder media throughout — NOT product-parity evidence
 * (AGENTS.md).
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTRACTS_VERSION,
  GeneratedArtifactSchema,
  type GeneratedArtifact,
  type OverviewPlan,
} from '../../src/contracts';
import { STYLE_BIBLE_VERSION } from '../../src/video/style-bible';

export const MANIFEST_TOOL_ID = 'wflx-manifest-registry';
export const MANIFEST_TOOL_VERSION = '0.1.0';
export const REGISTRY_RECORD_TYPE = 'wflx-unified-artifact-registry';
export const REGISTRY_SHAPE_VERSION = '1.0.0';

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestError';
  }
}

// ---------------------------------------------------------------------------
// Canonical serialization (mirrors the audio/video stableStringify convention)
// ---------------------------------------------------------------------------

/** Key-sorted canonical JSON — deterministic byte output for records. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function fileBytes(path: string): number {
  return readFileSync(path).byteLength;
}

// ---------------------------------------------------------------------------
// Registry types
// ---------------------------------------------------------------------------

export type RegistrySurface = 'audio' | 'video';

export interface SidecarEntry {
  /** Sidecar file name (beside artifact.json / the media). */
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface MediaEntry {
  /** Expected media file name (overview.<container>). */
  readonly file: string;
  /** False for fingerprint-only runs (golden-reference convention). */
  readonly present: boolean;
  /** sha256(media bytes) === artifact.media.sha256; null when media absent. */
  readonly sha256Match: boolean | null;
}

export interface PlanRef {
  readonly id: string;
  /** Where the plan record was resolved from. */
  readonly source: 'sidecar' | 'fixture' | 'unresolved';
  readonly file: string | null;
  readonly sha256: string | null;
  readonly contractVersion: string | null;
  readonly generator: { readonly name: string; readonly version: string; readonly seed: string } | null;
}

export interface RegistryRecord {
  readonly surface: RegistrySurface;
  /** Repo-relative directory of the artifact run (e.g. artifacts/audio/exp-a/deepdive-5min-baseline). */
  readonly directory: string;
  /** The validated GeneratedArtifact record, inlined. */
  readonly artifact: GeneratedArtifact;
  /** sha256 of the artifact.json sidecar file itself (registry/store drift check). */
  readonly artifactJsonSha256: string;
  readonly sidecars: readonly SidecarEntry[];
  readonly media: MediaEntry;
  readonly plan: PlanRef;
  /** Reproducibility seed chain: surface seed + Director (plan) seed. */
  readonly seeds: { readonly artifactSeed: string | null; readonly planSeed: string | null };
  /** Provider identities per stage (denormalized from artifact.providers). */
  readonly providerIdentities: readonly string[];
  /**
   * Video records: STYLE_BIBLE_VERSION read from src/video/style-bible.ts
   * (DOCUMENTED gap: not emitted by src/video/artifacts.ts — HANDOFF C-9).
   * Audio records: null (StyleBible is a video-surface concept).
   */
  readonly styleBibleVersion: string | null;
  readonly notes: string;
}

export interface RegistryToolVersions {
  readonly manifestTool: string;
  readonly bun: string;
  readonly zod: string | null;
  readonly typescript: string | null;
}

export interface RegistryMetadata {
  readonly contractsVersion: string;
  readonly styleBibleVersion: string;
  readonly styleBibleVersionSource: string;
  readonly toolVersions: RegistryToolVersions;
  readonly audioRoot: string;
  readonly videoRoot: string;
  readonly fixtureRoot: string;
  readonly surfaceLogs: readonly SidecarEntry[];
  readonly notes: readonly string[];
}

export interface UnifiedManifestRegistry {
  readonly recordType: typeof REGISTRY_RECORD_TYPE;
  readonly registryVersion: string;
  readonly generatedAt: string;
  readonly generatedAtSource: 'flag' | 'wall-clock';
  readonly metadata: RegistryMetadata;
  readonly counts: { readonly total: number; readonly audio: number; readonly video: number };
  readonly records: readonly RegistryRecord[];
}

export interface BuildRegistryOptions {
  /** Audio artifacts root (default 'artifacts/audio'). */
  readonly audioRoot?: string;
  /** Video artifacts root (default 'artifacts/video'). */
  readonly videoRoot?: string;
  /** Plan fixture root for plan resolution (default 'fixtures/contracts'). */
  readonly fixtureRoot?: string;
  /** Registry timestamp — REQUIRED for byte-reproducible output. */
  readonly now: string;
  /** How `now` was obtained; 'wall-clock' marks a run-specific registry. */
  readonly generatedAtSource?: 'flag' | 'wall-clock';
}

// ---------------------------------------------------------------------------
// Plan fixture index
// ---------------------------------------------------------------------------

interface PlanFixture {
  readonly file: string;
  readonly sha256: string;
  readonly plan: OverviewPlan;
}

function loadPlanFixtures(fixtureRoot: string): Map<string, PlanFixture> {
  const index = new Map<string, PlanFixture>();
  if (!existsSync(fixtureRoot)) return index;
  for (const entry of readdirSync(fixtureRoot, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    if (!entry.isFile() || !entry.name.startsWith('plan-') || !entry.name.endsWith('.json')) continue;
    const file = join(fixtureRoot, entry.name);
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    const plan = parsed as OverviewPlan;
    if (plan.recordType !== 'OverviewPlan') continue;
    index.set(plan.id, { file, sha256: sha256File(file), plan });
  }
  return index;
}

// ---------------------------------------------------------------------------
// Dependency tool versions (environment facts, recorded honestly)
// ---------------------------------------------------------------------------

function dependencyVersion(packageDir: string): string | null {
  const path = join(packageDir, 'package.json');
  if (!existsSync(path)) return null;
  try {
    const pkg = JSON.parse(readFileSync(path, 'utf8')) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Record building
// ---------------------------------------------------------------------------

function listJsonSidecars(dir: string): SidecarEntry[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'artifact.json')
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((entry) => {
      const path = join(dir, entry.name);
      return { file: entry.name, sha256: sha256File(path), bytes: fileBytes(path) };
    });
}

function findArtifactDirs(root: string): string[] {
  const found: string[] = [];
  if (!existsSync(root)) return found;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      if (!entry.isDirectory()) continue;
      const child = join(dir, entry.name);
      if (existsSync(join(child, 'artifact.json'))) {
        found.push(child);
      } else {
        walk(child);
      }
    }
  };
  walk(root);
  return found;
}

function resolvePlan(
  dir: string,
  planId: string,
  fixtures: Map<string, PlanFixture>,
): PlanRef {
  const sidecarPath = join(dir, 'plan.json');
  if (existsSync(sidecarPath)) {
    const plan = JSON.parse(readFileSync(sidecarPath, 'utf8')) as OverviewPlan;
    return {
      id: planId,
      source: 'sidecar',
      file: 'plan.json',
      sha256: sha256File(sidecarPath),
      contractVersion: plan.contractVersion ?? null,
      generator:
        plan.generator !== undefined
          ? {
              name: plan.generator.name,
              version: plan.generator.version,
              seed: plan.generator.seed,
            }
          : null,
    };
  }
  const fixture = fixtures.get(planId);
  if (fixture !== undefined) {
    return {
      id: planId,
      source: 'fixture',
      file: fixture.file,
      sha256: fixture.sha256,
      contractVersion: fixture.plan.contractVersion,
      generator: {
        name: fixture.plan.generator.name,
        version: fixture.plan.generator.version,
        seed: fixture.plan.generator.seed,
      },
    };
  }
  return { id: planId, source: 'unresolved', file: null, sha256: null, contractVersion: null, generator: null };
}

function buildRecord(
  surface: RegistrySurface,
  dir: string,
  fixtures: Map<string, PlanFixture>,
): RegistryRecord {
  const artifactPath = join(dir, 'artifact.json');
  const raw = JSON.parse(readFileSync(artifactPath, 'utf8')) as unknown;
  const guard = GeneratedArtifactSchema.safeParse(raw);
  if (!guard.success) {
    throw new ManifestError(
      `${artifactPath} fails the GeneratedArtifact guard: ${guard.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    );
  }
  const artifact = guard.data;
  const expectedKind = surface === 'audio' ? 'audio-overview' : 'video-overview';
  if (artifact.kind !== expectedKind) {
    throw new ManifestError(
      `${artifactPath}: kind '${artifact.kind}' does not match the '${surface}' surface (expected '${expectedKind}')`,
    );
  }

  const mediaFile = `overview.${artifact.media.container}`;
  const mediaPath = join(dir, mediaFile);
  const mediaPresent = existsSync(mediaPath);
  const sha256Match = mediaPresent ? sha256File(mediaPath) === artifact.media.sha256 : null;
  if (mediaPresent && sha256Match !== true) {
    throw new ManifestError(
      `${mediaPath}: on-disk sha256 does not match artifact.media.sha256 — the store is inconsistent ` +
        `(media regenerated without refreshing the sidecar?)`,
    );
  }

  const plan = resolvePlan(dir, artifact.planId, fixtures);
  const artifactSeed = artifact.generator.seed ?? null;
  const planSeed = plan.generator?.seed ?? null;

  const providerIdentities = artifact.providers.map((p) =>
    `${p.stage}=${p.provider}${p.model !== undefined ? `@${p.model}` : ''}`,
  );

  const notes = mediaPresent
    ? 'media committed beside the sidecar; sha256 verified against artifact.media.sha256'
    : 'media fingerprinted (artifact.media.sha256) but not committed — golden-reference convention';

  return {
    surface,
    directory: dir,
    artifact,
    artifactJsonSha256: sha256File(artifactPath),
    sidecars: listJsonSidecars(dir),
    media: { file: mediaFile, present: mediaPresent, sha256Match },
    plan,
    seeds: { artifactSeed, planSeed },
    providerIdentities,
    styleBibleVersion: surface === 'video' ? STYLE_BIBLE_VERSION : null,
    notes,
  };
}

function surfaceLog(root: string): SidecarEntry[] {
  const path = join(root, 'benchmark-run.json');
  if (!existsSync(path)) return [];
  return [{ file: join(root, 'benchmark-run.json'), sha256: sha256File(path), bytes: fileBytes(path) }];
}

// ---------------------------------------------------------------------------
// The registry builder
// ---------------------------------------------------------------------------

export function buildUnifiedRegistry(options: BuildRegistryOptions): UnifiedManifestRegistry {
  const audioRoot = options.audioRoot ?? 'artifacts/audio';
  const videoRoot = options.videoRoot ?? 'artifacts/video';
  const fixtureRoot = options.fixtureRoot ?? 'fixtures/contracts';
  const fixtures = loadPlanFixtures(fixtureRoot);

  const records: RegistryRecord[] = [];
  for (const dir of findArtifactDirs(audioRoot)) {
    records.push(buildRecord('audio', dir, fixtures));
  }
  for (const dir of findArtifactDirs(videoRoot)) {
    records.push(buildRecord('video', dir, fixtures));
  }
  records.sort((a, b) =>
    a.surface !== b.surface
      ? a.surface < b.surface
        ? -1
        : 1
      : a.directory < b.directory
        ? -1
        : a.directory > b.directory
          ? 1
          : 0,
  );

  const counts = {
    total: records.length,
    audio: records.filter((r) => r.surface === 'audio').length,
    video: records.filter((r) => r.surface === 'video').length,
  };

  const metadata: RegistryMetadata = {
    contractsVersion: CONTRACTS_VERSION,
    styleBibleVersion: STYLE_BIBLE_VERSION,
    styleBibleVersionSource:
      `read from STYLE_BIBLE_VERSION in src/video/style-bible.ts; DOCUMENTED GAP: video ` +
      `GeneratedArtifact manifests do NOT emit styleBibleVersion (src/video/artifacts.ts does not ` +
      `reference the const) — HANDOFF C-9 to the v2 contract wave (checklist §2 post-W3 audit)`,
    toolVersions: {
      manifestTool: `${MANIFEST_TOOL_ID}@${MANIFEST_TOOL_VERSION}`,
      bun: Bun.version,
      zod: dependencyVersion('node_modules/zod'),
      typescript: dependencyVersion('node_modules/typescript'),
    },
    audioRoot,
    videoRoot,
    fixtureRoot,
    surfaceLogs: [...surfaceLog(audioRoot), ...surfaceLog(videoRoot)],
    notes: [
      'Offline placeholder media throughout (deterministic-offline-tts speech, marker-tone narration, deterministic-ink illustrations) — NOT product parity evidence (AGENTS.md).',
      'Audio determinism layer: turns, timing manifest, QA report, artifact sidecar and WAV bytes (byte-identical same-seed regeneration, tests/audio).',
      'Video determinism layer: scene SVG set, timeline, narration WAV and QA reports; MP4 bytes are encoder-dependent and byte-stability across environments is NOT claimed (artifacts/video/README.md).',
      'Registry determinism: identical store bytes plus identical --now produce a byte-identical registry (canonical key-sorted serialization).',
      'Run-specific wall-clock logs (benchmark-run.json) are hashed as surfaceLogs, never inlined — latency is not reproducible metadata.',
    ],
  };

  return {
    recordType: REGISTRY_RECORD_TYPE,
    registryVersion: REGISTRY_SHAPE_VERSION,
    generatedAt: options.now,
    generatedAtSource: options.generatedAtSource ?? 'flag',
    metadata,
    counts,
    records,
  };
}

/** Canonical serialized registry (deterministic bytes; trailing newline). */
export function serializeRegistry(registry: UnifiedManifestRegistry): string {
  return `${stableStringify(registry)}\n`;
}
