/**
 * EXP-L-01 runner — WFLX-P1 Deliverable A (EV-016): REAL live TTS execution
 * path through the existing multi-speaker adapter interface.
 *
 * Question under test: can the canonical 42 s deep-dive audio benchmark plan
 * be compiled END-TO-END through a REAL production TTS provider (server-side
 * z-ai-web-dev-sdk speech synthesis via the SpeechProvider port), with
 * honest per-run provenance — while the offline deterministic path stays the
 * DEFAULT and byte-unchanged?
 *
 * Arms:
 *   1. Gating probe (no network): selectSpeechProvider factory behavior —
 *      env WFLX_TTS_PROVIDER=live-zai selects the ZaiLiveTts adapter; unset
 *      env stays the offline deterministic default (zero behavior change).
 *   2. LIVE arm: compileAudioOverview over the canonical 42 s benchmark plan
 *      with a REAL ZaiLiveTts provider instance (instrumented wrapper records
 *      per-turn wall latency + payload bytes; the wrapper delegates 1:1 to
 *      the adapter — same interface the factory selects). Real per-turn WAV
 *      segments + mixed master are persisted.
 *   3. OFFLINE control (F4): with the env flag UNSET, the offline provider
 *      compiles the same plan TWICE — byte-identical pair AND byte-identical
 *      to the committed benchmark-deep-dive-42s artifacts (no drift).
 *
 * FALSIFIERS (structural — live output is honestly stochastic like the real
 * product per LAB-06; byte-identity is NEVER claimed for the live arm):
 *   F1 valid playable WAV per turn (RIFF/WAVE header, 24 kHz, mono, 16-bit,
 *      data-chunk consistency, decodable, non-trivial duration);
 *   F2 per-turn segment count == plan turn count (5);
 *   F3 total live duration within an EXPLICIT RECORDED band of the 42 s plan
 *      target — band [0.5x, 2.0x] = [21, 84] s, justified BEFORE the recorded
 *      run by: natural speech-rate envelope (1.5-3 wps) vs the 2.3 wps
 *      planning prior (~±30% systematic), the real product's own run-to-run
 *      duration variance (±10-20%, OBSERVED LAB-06), and slower-voice margin
 *      (a design probe informed feasibility, recorded in the summary);
 *   F4 offline baseline outputs byte-UNCHANGED when the live flag is off
 *      (double-run byte-identical + committed-fingerprint equality).
 *
 * Outputs (artifacts/README.md naming + provenance rules):
 *   artifacts/audio/exp-l-01/plan.json                (recipe input)
 *   artifacts/audio/exp-l-01/overview.wav             (live mixed master)
 *   artifacts/audio/exp-l-01/artifact.json            (live sidecar)
 *   artifacts/audio/exp-l-01/qa-report.json           (live QA)
 *   artifacts/audio/exp-l-01/timing-manifest.json     (live timing)
 *   artifacts/audio/exp-l-01/turns/<turnId>.wav       (real per-turn speech)
 *   artifacts/audio/exp-l-01/live-run.json            (latency/provenance/falsifiers)
 *   artifacts/audio/exp-l-01/offline-control.json     (F4 control record)
 *
 * Live evidence is REAL service output (OBSERVED at run time); it is NOT
 * product-parity evidence (AGENTS.md) and NOT byte-reproducible.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileAudioOverview, stableStringify } from '../src/audio';
import { decodeWav } from '../src/audio/mixing/wav';
import { selectSpeechProvider } from '../src/providers/audio/factory';
import { ZaiLiveTts } from '../src/providers/audio/zai-live';
import type {
  AudioPayload,
  SpeakerId,
  SpeakerVoiceProfile,
  SpeechProvider,
  SpeechTurnRequest,
  SpeechTurnResult,
} from '../src/providers/audio/port';
import {
  buildShortBenchmarkPlan,
  CANONICAL_GRAPH,
  CANONICAL_SOURCE,
  FIXED_NOW,
  FIXED_SEED,
} from '../tests/audio/fixtures';

const OUT_ROOT = 'artifacts/audio/exp-l-01';
const COMMITTED_BENCHMARK_DIR = 'artifacts/audio/benchmark-deep-dive-42s';

/** Explicit duration band for F3 (declared with rationale above). */
const BAND_MIN = 21;
const BAND_MAX = 84;

interface TurnMeasurement {
  readonly turnId: string;
  readonly speakerId: string;
  readonly latencyMs: number;
  readonly payloadBytes: number;
  readonly durationSeconds: number;
  readonly targetSeconds: number;
  readonly chunks: number;
  readonly textChars: number;
  readonly textWords: number;
}

/** 1:1 instrumentation wrapper — delegates everything, records per-turn. */
class InstrumentedProvider implements SpeechProvider {
  readonly measurements: TurnMeasurement[] = [];

  constructor(private readonly inner: SpeechProvider) {}

  get id(): string {
    return this.inner.id;
  }

  get kind(): SpeechProvider['kind'] {
    return this.inner.kind;
  }

  get modelId(): string | undefined {
    return this.inner.modelId;
  }

  capabilities() {
    return this.inner.capabilities();
  }

  requiredCredentialKeys(): readonly string[] {
    return this.inner.requiredCredentialKeys();
  }

  async synthesizeTurn(
    request: SpeechTurnRequest,
    voices: ReadonlyMap<SpeakerId, SpeakerVoiceProfile>,
  ): Promise<SpeechTurnResult> {
    const startedAt = performance.now();
    const result = await this.inner.synthesizeTurn(request, voices);
    const latencyMs = Math.round(performance.now() - startedAt);
    this.measurements.push({
      turnId: request.turnId,
      speakerId: request.speakerId,
      latencyMs,
      payloadBytes: result.audio.data.byteLength,
      durationSeconds: result.durationSeconds,
      targetSeconds: request.targetSeconds ?? 0,
      chunks: Math.max(1, Math.ceil(request.text.length / 1024)),
      textChars: request.text.length,
      textWords: request.text.trim().split(/\s+/).filter(Boolean).length,
    });
    return result;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    return this.inner.healthCheck?.() ?? { ok: true };
  }
}

/** WAV structural validity check (F1). */
interface WavValidity {
  readonly turnId: string;
  readonly valid: boolean;
  readonly problems: readonly string[];
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitsPerSample: number;
  readonly durationSeconds: number;
}

function checkWavValidity(turnId: string, payload: AudioPayload): WavValidity {
  const problems: string[] = [];
  const bytes = payload.data;
  const magic = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0);
  const waveMagic = String.fromCharCode(bytes[8] ?? 0, bytes[9] ?? 0, bytes[10] ?? 0, bytes[11] ?? 0);
  if (magic !== 'RIFF' || waveMagic !== 'WAVE') problems.push(`bad magic '${magic}/${waveMagic}'`);
  if (payload.container !== 'wav') problems.push(`container '${payload.container}'`);
  if (payload.sampleRate !== 24000) problems.push(`sampleRate ${payload.sampleRate} != 24000`);
  if (payload.channels !== 1) problems.push(`channels ${payload.channels} != 1`);
  if (payload.bitsPerSample !== 16) problems.push(`bitsPerSample ${payload.bitsPerSample} != 16`);
  let decodedSeconds = 0;
  try {
    const decoded = decodeWav(bytes);
    decodedSeconds = decoded.samples.length / decoded.sampleRate;
    if (decoded.samples.length === 0) problems.push('zero samples');
    if (decodedSeconds < 0.5) problems.push(`trivial duration ${decodedSeconds.toFixed(2)} s`);
  } catch (cause) {
    problems.push(`undecodable: ${String(cause)}`);
  }
  const expectedBytes = Math.round(decodedSeconds * payload.sampleRate) * 2 + 44;
  if (problems.length === 0 && Math.abs(bytes.byteLength - expectedBytes) > 64) {
    problems.push(`byte length ${bytes.byteLength} vs expected ~${expectedBytes}`);
  }
  return {
    turnId,
    valid: problems.length === 0,
    problems,
    sampleRate: payload.sampleRate,
    channels: payload.channels,
    bitsPerSample: payload.bitsPerSample,
    durationSeconds: decodedSeconds,
  };
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${stableStringify(value)}\n`, 'utf8');
}

async function main(): Promise<void> {
  mkdirSync(join(OUT_ROOT, 'turns'), { recursive: true });
  const plan = buildShortBenchmarkPlan();

  // -----------------------------------------------------------------------
  // Arm 1: gating probe (factory behavior, no network)
  // -----------------------------------------------------------------------
  const gatedLive = selectSpeechProvider({
    env: { WFLX_TTS_PROVIDER: 'live-zai' },
    seed: FIXED_SEED,
  });
  const gatedDefault = selectSpeechProvider({ env: {}, seed: FIXED_SEED });
  const gating = {
    liveFlagSelectsZai:
      gatedLive.choice === 'live-zai' && gatedLive.provider instanceof ZaiLiveTts,
    unsetFlagStaysOffline:
      gatedDefault.choice === 'offline' &&
      gatedDefault.provider.id === 'deterministic-offline-tts',
    offlineZeroBehaviorChange:
      gatedDefault.provider.kind === 'offline-deterministic' &&
      gatedDefault.provider.requiredCredentialKeys().length === 0,
  };
  console.log(
    `[gating] WFLX_TTS_PROVIDER=live-zai -> ${gatedLive.provider.id}; unset -> ${gatedDefault.provider.id}`,
  );

  // -----------------------------------------------------------------------
  // Arm 2: LIVE compile through the REAL service
  // -----------------------------------------------------------------------
  // Env-gated activation is proven by the gating probe above; the live arm
  // injects the adapter instance explicitly so per-turn latency/size
  // instrumentation can wrap it (1:1 delegation, same class the flag selects).
  const liveProvider = new InstrumentedProvider(new ZaiLiveTts({}));
  const health = await liveProvider.healthCheck();
  console.log(`[live] healthCheck: ${JSON.stringify(health)}`);

  const liveStartedAt = performance.now();
  const live = await compileAudioOverview({
    plan,
    graph: CANONICAL_GRAPH,
    sources: CANONICAL_SOURCE,
    options: {
      seed: FIXED_SEED,
      now: FIXED_NOW,
      mastering: 'pure-ts',
      provider: liveProvider,
      notes:
        'EXP-L-01 LIVE run (EV-016): real speech synthesized by the z-ai-web-dev-sdk server-side TTS service through the SpeechProvider port (adapter zai-live-tts). Honestly stochastic per call (LAB-06 discipline) — byte-identity NOT claimed for this artifact. Env activation flag: WFLX_TTS_PROVIDER=live-zai. Offline deterministic path remains the DEFAULT and is byte-unchanged (F4). Live speech, not product-parity evidence (AGENTS.md).',
    },
  });
  const liveWallMs = Math.round(performance.now() - liveStartedAt);

  // Persist per-turn real speech segments.
  for (const segment of live.synthesis) {
    writeFileSync(join(OUT_ROOT, 'turns', `${segment.turnId}.wav`), segment.audio.data);
  }
  // Persist master + sidecars (the benchmark artifact schema).
  writeFileSync(join(OUT_ROOT, 'overview.wav'), live.wav);
  writeJson(join(OUT_ROOT, 'artifact.json'), live.artifact);
  writeJson(join(OUT_ROOT, 'qa-report.json'), live.qa);
  writeJson(join(OUT_ROOT, 'timing-manifest.json'), live.timing);
  writeJson(join(OUT_ROOT, 'plan.json'), plan);

  // F1: WAV validity per turn.
  const wavChecks = live.synthesis.map((segment) => checkWavValidity(segment.turnId, segment.audio));
  // F2: segment count == plan turns.
  const turnCountMatch =
    live.synthesis.length === plan.audioTurns.length &&
    live.synthesis.every((segment, i) => segment.turnId === plan.audioTurns[i]?.id);
  // F3: total duration within the explicit recorded band.
  const totalLiveSeconds = live.timing.totalDurationMs / 1000;
  const withinBand = totalLiveSeconds >= BAND_MIN && totalLiveSeconds <= BAND_MAX;

  const liveRun = {
    recordType: 'wflx-exp-l-01-live-run',
    experimentId: 'EXP-L-01',
    generatedBy: 'experiments/run-exp-l-01.ts',
    provider: {
      id: 'zai-live-tts',
      kind: 'remote-single-speaker',
      sdk: 'z-ai-web-dev-sdk@0.0.18 (server-side)',
      model: live.artifact.providers.find((p) => p.stage === 'speech')?.model ?? 'zai-tts-1',
      envActivationFlag: 'WFLX_TTS_PROVIDER=live-zai (gating probe proven; instance injected for per-turn instrumentation)',
      voices: {
        'host-a': 'tongtong (from descriptor female-warm-analytical)',
        'host-b': 'xiaochen (from descriptor male-grounded-analytical)',
      },
      credentialKeys: [],
      notes: 'No credential material in code, artifacts or logs (AGENTS.md).',
    },
    healthCheck: health,
    gating,
    perTurn: liveProvider.measurements,
    totals: {
      turns: live.synthesis.length,
      liveWallMs,
      speechWallMs: liveProvider.measurements.reduce((a, m) => a + m.latencyMs, 0),
      totalDurationSeconds: totalLiveSeconds,
      planTargetSeconds: plan.targetDurationSeconds,
      realizedWords: liveProvider.measurements.reduce((a, m) => a + m.textWords, 0),
      measuredWordsPerSecond:
        liveProvider.measurements.reduce((a, m) => a + m.textWords, 0) /
        liveProvider.measurements.reduce((a, m) => a + m.durationSeconds, 0),
      masterWavBytes: live.wav.byteLength,
      masterSha256: sha256Hex(live.wav),
    },
    durationBand: {
      minSeconds: BAND_MIN,
      maxSeconds: BAND_MAX,
      rationale:
        '0.5x-2.0x of the 42 s plan target: natural speech-rate envelope (1.5-3 wps) vs the 2.3 wps planning prior (~±30% systematic) + real-product run-to-run duration variance (±10-20%, OBSERVED LAB-06) + slower-voice margin. Declared before the recorded run (a feasibility design probe informed the harness, not the band).',
    },
    usageObservables: {
      sdkReportedUsage: 'none — the SDK TTS route exposes no usage/cost metadata beyond the response payload (UNRESOLVED, recorded honestly)',
      recordedProxies: 'per-turn payload bytes + per-turn wall latency + per-turn duration (see perTurn)',
      costUsd: 'UNRESOLVED for the live route (no metering surface); offline path costs $0 (recorded in its sidecar)',
    },
    falsifiers: {
      F1_validPlayableWavPerTurn: wavChecks.every((check) => check.valid),
      F1_detail: wavChecks,
      F2_turnCountMatchesPlan: turnCountMatch,
      F3_totalDurationWithinBand: withinBand,
      F3_totalSeconds: totalLiveSeconds,
      F4_offlineBaselineByteUnchanged: 'computed in the offline control arm below (offline-control.json)',
    },
    qaStatus: live.qa.status,
    qaIssues: live.qa.issues,
    reproducibility: 'Live output is stochastic per call — this record documents ONE real run; regeneration will differ (LAB-06 discipline).',
  };
  writeJson(join(OUT_ROOT, 'live-run.json'), liveRun);
  console.log(
    `[live] ${live.synthesis.length} turns, total ${totalLiveSeconds.toFixed(2)} s (band [${BAND_MIN}, ${BAND_MAX}]: ${withinBand ? 'PASS' : 'FAIL'}), wall ${liveWallMs} ms, qa ${live.qa.status}`,
  );

  // -----------------------------------------------------------------------
  // Arm 3: OFFLINE control (F4) — flag UNSET, double-run, committed equality
  // -----------------------------------------------------------------------
  delete process.env.WFLX_TTS_PROVIDER;
  const offlineOne = await compileAudioOverview({
    plan,
    graph: CANONICAL_GRAPH,
    sources: CANONICAL_SOURCE,
    options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
  });
  const offlineTwo = await compileAudioOverview({
    plan,
    graph: CANONICAL_GRAPH,
    sources: CANONICAL_SOURCE,
    options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
  });
  const runOneWav = sha256Hex(offlineOne.wav);
  const runTwoWav = sha256Hex(offlineTwo.wav);
  const runOneSidecar = sha256Hex(Buffer.from(stableStringify(offlineOne.artifact), 'utf8'));
  const runTwoSidecar = sha256Hex(Buffer.from(stableStringify(offlineTwo.artifact), 'utf8'));

  const committedWav = readFileSync(join(COMMITTED_BENCHMARK_DIR, 'overview.wav'));
  const committedSidecar = JSON.parse(
    readFileSync(join(COMMITTED_BENCHMARK_DIR, 'artifact.json'), 'utf8'),
  ) as { media: { sha256: string } };
  const committedWavHash = sha256Hex(committedWav);
  const committedMatch = committedWavHash === committedSidecar.media.sha256;
  const regeneratedMatchesCommitted = runOneWav === committedWavHash;

  const offlineControl = {
    recordType: 'wflx-exp-l-01-offline-control',
    note: 'F4: live flag UNSET (default offline path); double-run byte-identity + committed benchmark fingerprint equality — zero drift from the WFLX-P1 additive changes.',
    envFlagState: 'WFLX_TTS_PROVIDER unset',
    provider: offlineOne.artifact.providers.find((p) => p.stage === 'speech')?.provider,
    runOneWavSha256: runOneWav,
    runTwoWavSha256: runTwoWav,
    runOneSidecarSha256: runOneSidecar,
    runTwoSidecarSha256: runTwoSidecar,
    committedBenchmarkWavSha256: committedWavHash,
    committedSidecarMediaSha256: committedSidecar.media.sha256,
    doubleRunByteIdentical: runOneWav === runTwoWav && runOneSidecar === runTwoSidecar,
    committedSidecarInternallyConsistent: committedMatch,
    regeneratedMatchesCommittedBenchmark: regeneratedMatchesCommitted,
    artifactIdsEqual: offlineOne.artifact.id === offlineTwo.artifact.id,
  };
  writeJson(join(OUT_ROOT, 'offline-control.json'), offlineControl);
  console.log(
    `[offline] double-run identical: ${offlineControl.doubleRunByteIdentical}; matches committed benchmark: ${regeneratedMatchesCommitted}`,
  );

  const allFalsifiers =
    wavChecks.every((check) => check.valid) &&
    turnCountMatch &&
    withinBand &&
    offlineControl.doubleRunByteIdentical &&
    offlineControl.regeneratedMatchesCommittedBenchmark;

  console.log(
    `[exp-l-01] F1=${String(wavChecks.every((c) => c.valid))} F2=${String(turnCountMatch)} F3=${String(withinBand)} F4=${String(offlineControl.doubleRunByteIdentical && offlineControl.regeneratedMatchesCommittedBenchmark)} -> ${allFalsifiers ? 'ALL PASS' : 'FALSIFIER FAILURE'}`,
  );
  if (!allFalsifiers) {
    process.exitCode = 1;
  }
}

await main();
