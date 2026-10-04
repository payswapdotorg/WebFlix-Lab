/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — pipeline boundary.
 *
 * THE ONE WIRING POINT between the studio and the real lab pipeline. This
 * module ONLY orchestrates existing, frozen exports — it re-implements
 * nothing:
 *
 *   MarkdownNoteAdapter (src/source)            -> SourceArtifact
 *   DeterministicExtractor (src/source/graph)   -> SemanticGraph
 *   compileOverviewPlan (src/director)          -> OverviewPlan
 *   compileAudioOverview (src/audio)            -> AudioOverviewResult
 *
 * Determinism spine (binding): the studio pins fixed seed/now constants and
 * the offline deterministic speech provider, and the pure-TS mastering
 * backend. Two server boots fed identical compile requests therefore produce
 * byte-identical master WAVs (asserted in apps/studio/test/determinism.test.ts).
 * Compiled media lives in memory ONLY — the studio never writes artifacts/.
 *
 * Evidence class of everything produced here: REPRODUCED (lab
 * implementation; AGENTS.md). The offline provider's speech is placeholder
 * audio — never product-parity evidence.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AUDIO_OVERVIEW_MODES,
  type AudioOverviewMode,
  type SourceArtifact,
  type UtcTimestamp,
} from '../../src/contracts';
import { compileAudioOverview, type AudioOverviewResult } from '../../src/audio';
import { compileOverviewPlan } from '../../src/director/compiler';
import { MarkdownNoteAdapter, MARKDOWN_NOTE_ADAPTER_ID } from '../../src/source/markdown-note-adapter';
import {
  DeterministicExtractor,
  DETERMINISTIC_EXTRACTOR_ID,
} from '../../src/source/graph/deterministic-extractor';
import {
  CANONICAL_MODE_DURATION_SECONDS,
  DURATION_BOUNDS_SECONDS,
  STUDIO_AUDIO_MODES,
  type OverviewResponse,
  type ProviderState,
  type SourceDescriptor,
  type SourcesResponse,
  type TranscriptRow,
  type ValidOverviewRequest,
} from './api/types';

// ---------------------------------------------------------------------------
// Fixed constants (no hidden wall clock anywhere in the studio path)
// ---------------------------------------------------------------------------

export const STUDIO_DIRECTOR_SEED = 'wflx-studio-director-seed';
export const STUDIO_AUDIO_SEED = 'wflx-studio-audio-seed';
export const STUDIO_NOW: UtcTimestamp = '2026-10-04T00:00:00Z';

export const STUDIO_AUDIENCE = 'technical' as const;
export const STUDIO_LANGUAGE = 'en' as const;

const SURFACE_NOTE =
  'WebFlix-Lab research implementation (offline deterministic provider). ' +
  'REPRODUCED-class lab evidence — not the Gemini Notebook product (AGENTS.md).';

// ---------------------------------------------------------------------------
// Source catalog — checked-in fixtures usable as REAL pipeline sources
// ---------------------------------------------------------------------------

interface SourceCatalogEntry {
  readonly id: string;
  readonly label: string;
  readonly absolutePath: string;
}

/** Repo root (apps/studio/pipeline.ts -> two levels up). */
const REPO_ROOT = join(import.meta.dir, '..', '..');

const SOURCE_CATALOG: readonly SourceCatalogEntry[] = [
  {
    id: 'source-messy-note-redacted',
    label: 'fixtures/reference-messy-note-redacted.md',
    absolutePath: join(REPO_ROOT, 'fixtures', 'reference-messy-note-redacted.md'),
  },
];

// ---------------------------------------------------------------------------
// In-memory overview store (per server instance; never persisted)
// ---------------------------------------------------------------------------

export interface StoredOverview {
  readonly response: OverviewResponse;
  readonly wav: Uint8Array;
}

export interface StudioContext {
  readonly env: NodeJS.ProcessEnv;
  readonly store: Map<string, StoredOverview>;
}

export function createStudioContext(env: NodeJS.ProcessEnv = process.env): StudioContext {
  return { env, store: new Map() };
}

// ---------------------------------------------------------------------------
// Provider state (honest; live providers gated OFF, state-only)
// ---------------------------------------------------------------------------

const SPEECH_PROVIDER_ENV_FLAG = 'WFLX_AUDIO_SPEECH_PROVIDER';
const TTS_PROVIDER_ENV_FLAG = 'WFLX_TTS_PROVIDER';

export function providerStateFor(env: NodeJS.ProcessEnv): ProviderState {
  return {
    active: 'deterministic-offline-tts',
    choice: 'offline',
    note:
      'The studio pins the offline deterministic speech provider (placeholder audio). ' +
      'Env-gated live providers are NEVER switchable from the UI; their state is reported only.',
    gated: [
      {
        id: 'gemini-multi-speaker-tts',
        activation: `${SPEECH_PROVIDER_ENV_FLAG}=gemini (+ GEMINI_API_KEY, TL-side wiring)`,
        state:
          env[SPEECH_PROVIDER_ENV_FLAG] === 'gemini' ? 'env-requested' : 'off',
      },
      {
        id: 'zai-live-tts',
        activation: `${TTS_PROVIDER_ENV_FLAG}=live-zai`,
        state: env[TTS_PROVIDER_ENV_FLAG] === 'live-zai' ? 'env-requested' : 'off',
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Source enumeration (ingests through the REAL adapter; fingerprint as the
// repo computes it — src/source/normalize.ts fingerprintOf)
// ---------------------------------------------------------------------------

export async function listStudioSources(): Promise<SourcesResponse> {
  const adapter = new MarkdownNoteAdapter();
  const sources: SourceDescriptor[] = [];
  for (const entry of SOURCE_CATALOG) {
    const raw = readFileSync(entry.absolutePath, 'utf8');
    const artifact = await adapter.ingest({
      id: entry.id,
      label: entry.label,
      content: raw,
      createdAt: STUDIO_NOW,
    });
    sources.push({
      id: artifact.id,
      label: entry.label,
      title: artifact.title,
      adapter: MARKDOWN_NOTE_ADAPTER_ID,
      extractor: DETERMINISTIC_EXTRACTOR_ID,
      language: artifact.language,
      wordCount: artifact.wordCount,
      blockCount: artifact.blocks.length,
      fingerprint: {
        contentSha256: artifact.fingerprint.contentSha256,
        rawSha256: artifact.fingerprint.rawSha256,
        textLength: artifact.fingerprint.textLength,
      },
      modes: STUDIO_AUDIO_MODES.map((mode) => ({
        mode,
        canonicalDurationSeconds: CANONICAL_MODE_DURATION_SECONDS[mode],
        default: mode === 'deep-dive',
      })),
      durationBoundsSeconds: {
        min: DURATION_BOUNDS_SECONDS.min,
        max: DURATION_BOUNDS_SECONDS.max,
      },
    });
  }
  return {
    surface:
      'WebFlix-Lab research implementation — checked-in fixtures compiled through the real ' +
      'pipeline (source adapter -> understanding -> Director -> audio compile). ' +
      'Not the Gemini Notebook product.',
    sources,
  };
}

// ---------------------------------------------------------------------------
// Request validation (typed rejections; no domain logic)
// ---------------------------------------------------------------------------

export function validateOverviewRequest(input: {
  sourceId: unknown;
  mode: unknown;
  durationSeconds: unknown;
}): ValidOverviewRequest {
  const { sourceId, mode, durationSeconds } = input;
  if (typeof sourceId !== 'string' || sourceId.length === 0) {
    throw new StudioValidationError('invalid-body', 'sourceId must be a non-empty string');
  }
  if (!SOURCE_CATALOG.some((entry) => entry.id === sourceId)) {
    throw new StudioValidationError(
      'unknown-source',
      `unknown sourceId '${sourceId}' — enumerate via GET /api/sources`,
      { sourceId },
    );
  }
  if (mode !== undefined && typeof mode !== 'string') {
    throw new StudioValidationError(
      'invalid-mode',
      `mode must be one of ${AUDIO_OVERVIEW_MODES.join(' | ')} (got '${String(mode)}')`,
      { mode },
    );
  }
  const resolvedMode: string = mode ?? 'deep-dive';
  if (!AUDIO_OVERVIEW_MODES.includes(resolvedMode as AudioOverviewMode)) {
    throw new StudioValidationError(
      'invalid-mode',
      `mode must be one of ${AUDIO_OVERVIEW_MODES.join(' | ')} (got '${String(mode)}')`,
      { mode },
    );
  }
  const validatedMode = resolvedMode as AudioOverviewMode; // membership proven above
  const resolvedDurationRaw: unknown =
    durationSeconds ?? CANONICAL_MODE_DURATION_SECONDS[validatedMode];
  if (
    typeof resolvedDurationRaw !== 'number' ||
    !Number.isInteger(resolvedDurationRaw) ||
    resolvedDurationRaw < DURATION_BOUNDS_SECONDS.min ||
    resolvedDurationRaw > DURATION_BOUNDS_SECONDS.max
  ) {
    throw new StudioValidationError(
      'invalid-duration',
      `durationSeconds must be an integer in [${DURATION_BOUNDS_SECONDS.min}, ${DURATION_BOUNDS_SECONDS.max}] (got '${String(durationSeconds)}')`,
      { durationSeconds },
    );
  }
  return { sourceId, mode: validatedMode, durationSeconds: resolvedDurationRaw };
}

export class StudioValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'StudioValidationError';
  }
}

// ---------------------------------------------------------------------------
// THE compile call — the real chain, end to end, per request
// ---------------------------------------------------------------------------

export async function compileStudioOverview(
  ctx: StudioContext,
  request: ValidOverviewRequest,
): Promise<OverviewResponse> {
  const entry = SOURCE_CATALOG.find((candidate) => candidate.id === request.sourceId);
  if (entry === undefined) {
    throw new StudioValidationError('unknown-source', `unknown sourceId '${request.sourceId}'`);
  }
  const raw = readFileSync(entry.absolutePath, 'utf8');

  // 1. Real source adapter (parsing, normalization, credential-shape guard).
  const adapter = new MarkdownNoteAdapter();
  const source: SourceArtifact = await adapter.ingest({
    id: entry.id,
    label: entry.label,
    content: raw,
    createdAt: STUDIO_NOW,
  });

  // 2. Real understanding (deterministic extractor over the same sources).
  const graph = await new DeterministicExtractor().extract({
    sources: [source],
    options: { createdAt: STUDIO_NOW },
  });

  // 3. Real Director (editorial plan; derived plan id, fixed seed/now).
  const plan = compileOverviewPlan({
    sources: [source],
    graph,
    modality: 'audio',
    mode: request.mode,
    audience: STUDIO_AUDIENCE,
    language: STUDIO_LANGUAGE,
    targetDurationSeconds: request.durationSeconds,
    seed: STUDIO_DIRECTOR_SEED,
    now: STUDIO_NOW,
  });

  // 4. Real audio compile (dialogue graph -> realization -> offline speech ->
  //    timing -> pure-TS mix/master -> QA -> GeneratedArtifact sidecar).
  const result: AudioOverviewResult = await compileAudioOverview({
    plan,
    graph,
    sources: [source],
    options: {
      seed: STUDIO_AUDIO_SEED,
      now: STUDIO_NOW,
      providerChoice: 'offline',
      mastering: 'pure-ts',
      notes:
        'WebFlix-Lab Operator Studio compile (offline deterministic provider; ' +
        'REPRODUCED-class lab evidence — not product parity).',
    },
  });

  const response = assembleOverviewResponse(request.sourceId, result);
  ctx.store.set(response.artifactId, { response, wav: result.wav });
  return response;
}

// ---------------------------------------------------------------------------
// Response assembly (pure projection of the compiler result — no invention)
// ---------------------------------------------------------------------------

function assembleOverviewResponse(sourceId: string, result: AudioOverviewResult): OverviewResponse {
  const { plan, graph, timing, realized, artifact } = result;

  const timingByTurn = new Map(timing.entries.map((entry) => [entry.turnId, entry]));
  const personaNames = new Map<string, string>(
    graph.personas.map((persona) => [persona.speakerRole, persona.displayName]),
  );
  const purposes = new Map(graph.turns.map((turn) => [turn.id, turn.purpose]));

  const transcript: TranscriptRow[] = realized.map((turn) => {
    const entry = timingByTurn.get(turn.turnId);
    const speakerRole = entry?.speakerRole ?? 'unknown';
    return {
      turnId: turn.turnId,
      index: entry?.index ?? 0,
      speakerRole,
      speakerName: personaNames.get(speakerRole) ?? speakerRole,
      purpose: purposes.get(turn.turnId) ?? 'unknown',
      text: turn.text,
      wordCount: turn.wordCount,
      startMs: entry?.startMs ?? 0,
      endMs: entry?.endMs ?? 0,
    };
  });

  const speakers = new Set(plan.audioTurns.map((turn) => turn.speaker));

  return {
    artifactId: artifact.id,
    sourceId,
    evidenceClass: 'REPRODUCED',
    surfaceNote: SURFACE_NOTE,
    provider: artifact.providers
      .filter((usage) => usage.stage === 'speech')
      .map((usage) => usage.provider)[0] ?? 'deterministic-offline-tts',
    providerChoice: 'offline',
    mastering: result.master.backend,
    audioUrl: `/audio/${artifact.id}/master.wav`,
    plan: {
      planId: plan.id,
      // Director was called with modality 'audio' — the broad OverviewMode
      // union narrows by construction (compileOverviewPlan enforces it).
      mode: plan.mode as AudioOverviewMode,
      language: plan.language,
      audience: plan.audience,
      targetDurationSeconds: plan.targetDurationSeconds,
      planHash: timing.planHash,
      speakerCount: speakers.size,
      turnCount: plan.audioTurns.length,
      beatCount: plan.beats.length,
      coveredClaimCount: plan.coverage.covered.length,
      omittedClaimCount: plan.coverage.omitted.length,
      objective: plan.objective,
    },
    speakers: graph.personas.map((persona) => ({
      role: persona.speakerRole,
      name: persona.displayName,
    })),
    timing,
    transcript,
    artifact,
  };
}
