/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — the studio's own HTTP contract.
 *
 * Shared DTO vocabulary for the api/ handlers and the zero-build web client
 * (web/app.ts imports these as TYPE-ONLY imports; Bun's transpiler strips
 * them, so the browser bundle stays dependency-free). Domain types come from
 * the frozen W1 contracts via type-only imports — this file defines no
 * pipeline semantics of its own.
 *
 * Evidence law (AGENTS.md): every response this surface returns is
 * REPRODUCED-class lab implementation output. It never claims observation of
 * the Gemini Notebook product.
 */

import type { AudioOverviewMode, GeneratedArtifact, UtcTimestamp } from '../../../src/contracts';
import type { TimingManifest } from '../../../src/audio';

export const STUDIO_VERSION = 'wflx-studio@0.1.0';

/** Fixed port law: `bun run studio` always serves 4313. */
export const STUDIO_PORT = 4313;

/** Audio modes the Director already supports (no invented modes). */
export const STUDIO_AUDIO_MODES: readonly AudioOverviewMode[] = [
  'deep-dive',
  'brief',
  'critique',
  'debate',
];

/** Canonical duration per mode (the repo's canonical experiment arms). */
export const CANONICAL_MODE_DURATION_SECONDS: Readonly<Record<AudioOverviewMode, number>> = {
  'deep-dive': 300,
  brief: 120,
  critique: 300,
  debate: 300,
};

/** Duration bounds accepted by the compile route (Director supports any
 * positive target; the studio curates a sane operator range). */
export const DURATION_BOUNDS_SECONDS = { min: 60, max: 600 } as const;

// ---------------------------------------------------------------------------
// GET /api/sources
// ---------------------------------------------------------------------------

export interface SourceModeInfo {
  readonly mode: AudioOverviewMode;
  readonly canonicalDurationSeconds: number;
  readonly default: boolean;
}

export interface SourceDescriptor {
  readonly id: string;
  /** Repo-relative path label (provenance; never a secret). */
  readonly label: string;
  readonly title: string;
  readonly adapter: string;
  readonly extractor: string;
  readonly language: string;
  readonly wordCount: number;
  readonly blockCount: number;
  /** Fingerprint exactly as the repo computes it (src/source/normalize.ts). */
  readonly fingerprint: {
    readonly contentSha256: string;
    readonly rawSha256: string;
    readonly textLength: number;
  };
  readonly modes: readonly SourceModeInfo[];
  readonly durationBoundsSeconds: { readonly min: number; readonly max: number };
}

export interface SourcesResponse {
  readonly surface: string;
  readonly sources: readonly SourceDescriptor[];
}

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

export interface GatedProviderInfo {
  readonly id: string;
  readonly activation: string;
  /** 'off' | 'env-requested' — state only; never switchable from the UI. */
  readonly state: 'off' | 'env-requested';
}

export interface ProviderState {
  /** Active speech provider id (honest, from the compile path). */
  readonly active: string;
  readonly choice: 'offline';
  readonly note: string;
  readonly gated: readonly GatedProviderInfo[];
}

export interface HealthResponse {
  readonly ok: true;
  readonly version: string;
  readonly provider: ProviderState;
}

// ---------------------------------------------------------------------------
// POST /api/overview
// ---------------------------------------------------------------------------

export interface OverviewRequest {
  readonly sourceId: string;
  readonly mode?: AudioOverviewMode;
  readonly durationSeconds?: number;
}

/** Validated compile request (post-parse). */
export interface ValidOverviewRequest {
  readonly sourceId: string;
  readonly mode: AudioOverviewMode;
  readonly durationSeconds: number;
}

export interface PlanSummary {
  readonly planId: string;
  readonly mode: AudioOverviewMode;
  readonly language: string;
  readonly audience: string;
  readonly targetDurationSeconds: number;
  readonly planHash: string;
  readonly speakerCount: number;
  readonly turnCount: number;
  readonly beatCount: number;
  readonly coveredClaimCount: number;
  readonly omittedClaimCount: number;
  readonly objective: string;
}

export interface SpeakerInfo {
  readonly role: string;
  readonly name: string;
}

/** Realized turn joined with its timing entry — the player-facing view. */
export interface TranscriptRow {
  readonly turnId: string;
  readonly index: number;
  readonly speakerRole: string;
  readonly speakerName: string;
  readonly purpose: string;
  readonly text: string;
  readonly wordCount: number;
  readonly startMs: number;
  readonly endMs: number;
}

export interface OverviewResponse {
  readonly artifactId: string;
  readonly sourceId: string;
  readonly evidenceClass: 'REPRODUCED';
  readonly surfaceNote: string;
  /** Speech provider id used for this compile (reported honestly). */
  readonly provider: string;
  readonly providerChoice: 'offline';
  readonly mastering: string;
  readonly audioUrl: string;
  readonly plan: PlanSummary;
  readonly speakers: readonly SpeakerInfo[];
  readonly timing: TimingManifest;
  readonly transcript: readonly TranscriptRow[];
  /** The repo's artifact.json conventions (GeneratedArtifact sidecar). */
  readonly artifact: GeneratedArtifact;
}

// ---------------------------------------------------------------------------
// Errors + W2 session-boundary stubs
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  readonly error: string;
  readonly message: string;
  readonly stage?: string;
}

export interface SessionStubBody {
  readonly error: 'not-implemented-by-w1';
  readonly handoff: 'wflx-ui2';
}

export type { AudioOverviewMode, GeneratedArtifact, TimingManifest, UtcTimestamp };
