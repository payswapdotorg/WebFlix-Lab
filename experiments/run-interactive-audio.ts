/**
 * Interactive Audio Overview prototype runner — WFLX-P1 Deliverable C
 * (EV-018): join -> source-grounded response -> resume, on the canonical
 * fixture (plan-audio-deep-dive-5min over the reference-messy-note graph),
 * provider-independent (offline deterministic provider).
 *
 * Scripted demonstration (text-scripted stand-ins for the listener's VOICE
 * input — voice capture itself stays UNRESOLVED, recorded honestly):
 *
 *   session-01: after turn-6, "Can you say more about the open-source media
 *               projects and local model runtimes?" (should retrieve
 *               claim-oss-runtimes — content-matched grounding)
 *   session-02: after turn-13, "What does the note say about its purpose?"
 *               (should retrieve claim-purpose)
 *
 * FALSIFIERS (per the work order):
 *   F1 response turn is source-grounded (W1 deep validation + W2 dialogue
 *      graph rules + claim resolution — the grounding check);
 *   F2 original turns byte-identical across the intervention boundary
 *      (per-turn WAV sha256 + duration + gap equality; startMs shifts by
 *      EXACTLY the inserted response total post-boundary — the C-5 locality
 *      proof: the injection must not reshuffle untouched turns);
 *   F3 resume order preserved (session sequence == baseline sequence with
 *      the response turns inserted only at the boundary position);
 *   F4 determinism — the scripted session double-run is byte-identical
 *      (master WAV + session manifest).
 *
 * Outputs (artifacts/README.md naming; media fingerprinted-not-committed
 * per the 5-min golden-media precedent):
 *   artifacts/audio/interactive-01/baseline-deepdive-5min/   (sidecars)
 *   artifacts/audio/interactive-01/session-01/               (sidecars)
 *   artifacts/audio/interactive-01/session-02/               (sidecars)
 *   artifacts/audio/interactive-01/summary.json              (proofs)
 *
 * Lab reproduction evidence — NOT product-parity evidence (AGENTS.md).
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileAudioOverview, stableStringify } from '../src/audio';
import type { GeneratedArtifact } from '../src/contracts';
import {
  InteractiveAudioSession,
  type InteractiveSessionResult,
} from '../src/audio/interactive/session';
import {
  CANONICAL_GRAPH,
  CANONICAL_PLAN,
  CANONICAL_SOURCE,
  FIXED_NOW,
} from '../tests/audio/fixtures';

const OUT_ROOT = 'artifacts/audio/interactive-01';
const SESSION_SEED = 'wflx-interactive-audio-seed';

const INTERVENTIONS: {
  readonly runId: string;
  readonly afterTurnIndex: number;
  readonly listenerText: string;
  readonly artifactId: string;
}[] = [
  {
    runId: 'session-01',
    afterTurnIndex: 5,
    listenerText: 'Can you say more about the open-source media projects and local model runtimes?',
    artifactId: 'artifact-interactive-audio-session-01',
  },
  {
    runId: 'session-02',
    afterTurnIndex: 12,
    listenerText: 'What does the note say about its purpose?',
    artifactId: 'artifact-interactive-audio-session-02',
  },
];

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${stableStringify(value)}\n`, 'utf8');
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function persistSession(
  runId: string,
  result: InteractiveSessionResult,
  artifact: GeneratedArtifact,
): void {
  const dir = join(OUT_ROOT, runId);
  mkdirSync(dir, { recursive: true });
  writeJson(join(dir, 'artifact.json'), artifact);
  writeJson(join(dir, 'timing-manifest.json'), result.session.manifest);
  writeJson(join(dir, 'qa-report.json'), result.responseCompile.qa);
  writeJson(join(dir, 'response-plan.json'), result.responsePlan);
  writeJson(join(dir, 'intervention.json'), {
    afterTurnIndex: result.config.afterTurnIndex,
    listenerText: result.config.listenerText,
    listenerInputMode: 'text-scripted stand-in (voice capture UNRESOLVED — recorded honestly)',
    retrieval: {
      retrievedClaimIds: result.retrieval.retrievedClaimIds,
      matchedByContent: result.retrieval.matchedByContent,
    },
    responseTurnIds: result.responseCompile.timing.entries.map((entry) => entry.turnId),
    sessionArtifactId: result.session.artifactId,
    sessionMasterSha256: sha256Hex(result.session.wav),
    sessionMasterBytes: result.session.wav.byteLength,
    sessionTotalDurationMs: result.session.manifest.totalDurationMs,
    mediaNote: 'session master WAV fingerprinted (sha256 above), not committed — the 5-min golden-media precedent',
  });
}

async function main(): Promise<void> {
  mkdirSync(OUT_ROOT, { recursive: true });

  // --- baseline compile (canonical 5-min deep-dive, offline provider) -----
  const baseline = await compileAudioOverview({
    plan: CANONICAL_PLAN,
    graph: CANONICAL_GRAPH,
    sources: CANONICAL_SOURCE,
    options: {
      seed: SESSION_SEED,
      now: FIXED_NOW,
      mastering: 'pure-ts',
      notes: 'EV-018 baseline for the interactive audio session prototype (canonical 5-min deep-dive).',
    },
  });
  const baselineDir = join(OUT_ROOT, 'baseline-deepdive-5min');
  mkdirSync(baselineDir, { recursive: true });
  writeJson(join(baselineDir, 'artifact.json'), baseline.artifact);
  writeJson(join(baselineDir, 'qa-report.json'), baseline.qa);
  writeJson(join(baselineDir, 'timing-manifest.json'), baseline.timing);
  console.log(
    `[baseline] ${baseline.timing.entries.length} turns, ${(baseline.timing.totalDurationMs / 1000).toFixed(1)} s, qa ${baseline.qa.status}`,
  );

  const session = new InteractiveAudioSession({
    baseline,
    graph: CANONICAL_GRAPH,
    sources: [CANONICAL_SOURCE],
    seed: SESSION_SEED,
    now: FIXED_NOW,
    mastering: 'pure-ts',
  });

  const sessionRecords: Record<string, unknown> = {};
  const sessionArtifacts: Record<string, GeneratedArtifact> = {};
  for (const intervention of INTERVENTIONS) {
    const result = await session.intervene({
      afterTurnIndex: intervention.afterTurnIndex,
      listenerText: intervention.listenerText,
      artifactId: intervention.artifactId,
    });
    sessionArtifacts[intervention.runId] = result.session.artifact;
    persistSession(intervention.runId, result, result.session.artifact);

    const responseText = result.responseCompile.realized
      .map((turn) => `${turn.turnId} (${turn.wordCount} words): ${turn.text}`)
      .join('\n');
    console.log(`[${intervention.runId}] listener: "${intervention.listenerText}"`);
    console.log(
      `[${intervention.runId}] retrieved: ${result.retrieval.retrievedClaimIds.join(', ')} (content-matched: ${result.retrieval.matchedByContent})`,
    );
    console.log(`[${intervention.runId}] response realized:\n${responseText
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n')}`);
    console.log(
      `[${intervention.runId}] F1 grounding=${result.grounding.passed} F2 locality=${result.proofs.locality.passed} F3 order=${result.proofs.order.originalOrderPreserved} shift=${result.proofs.locality.postBoundaryShiftMs} ms`,
    );

    sessionRecords[intervention.runId] = {
      intervention: {
        afterTurnIndex: intervention.afterTurnIndex,
        listenerText: intervention.listenerText,
        listenerInputMode: 'text-scripted stand-in (voice capture UNRESOLVED)',
      },
      retrieval: {
        retrievedClaimIds: result.retrieval.retrievedClaimIds,
        matchedByContent: result.retrieval.matchedByContent,
      },
      response: {
        planId: result.responsePlan.id,
        turnIds: result.responseCompile.timing.entries.map((entry) => entry.turnId),
        realizedTexts: result.responseCompile.realized.map((turn) => turn.text),
        grounding: result.grounding,
      },
      session: {
        artifactId: result.session.artifactId,
        totalDurationMs: result.session.manifest.totalDurationMs,
        turnCount: result.session.manifest.entries.length,
        baselineTurnCount: baseline.timing.entries.length,
        masterSha256: sha256Hex(result.session.wav),
        masterBytes: result.session.wav.byteLength,
      },
      proofs: {
        F1_responseSourceGrounded: result.grounding.passed,
        F2_originalTurnsByteIdentical: {
          passed: result.proofs.locality.passed,
          rows: result.proofs.locality.rows,
          postBoundaryShiftMs: result.proofs.locality.postBoundaryShiftMs,
        },
        F3_resumeOrderPreserved: {
          passed: result.proofs.order.originalOrderPreserved,
          baselineSequence: result.proofs.order.baselineSequence,
          sessionSequence: result.proofs.order.sessionSequence,
        },
      },
    };
  }

  // --- F4: determinism — session-01 double-run byte-identical -------------
  const rerun = await session.intervene({
    afterTurnIndex: INTERVENTIONS[0]!.afterTurnIndex,
    listenerText: INTERVENTIONS[0]!.listenerText,
    artifactId: INTERVENTIONS[0]!.artifactId,
  });
  const first = sessionRecords['session-01'] as { session: { masterSha256: string } };
  const persistedManifest = readFileSync(join(OUT_ROOT, 'session-01', 'timing-manifest.json'), 'utf8');
  const determinism = {
    arm: 'session-01 (same baseline, same seed/now, same scripted intervention)',
    masterWavSha256Run1: first.session.masterSha256,
    masterWavSha256Run2: sha256Hex(rerun.session.wav),
    manifestEqual: stableStringify(rerun.session.manifest) === persistedManifest.trim(),
  };
  const byteIdentical = determinism.masterWavSha256Run1 === determinism.masterWavSha256Run2;
  console.log(
    `[F4] double-run master byte-identical: ${byteIdentical}; manifest equal: ${determinism.manifestEqual}`,
  );

  const summary = {
    recordType: 'wflx-interactive-audio-prototype',
    experimentId: 'EXP-L-03 (EV-018)',
    generatedBy: 'experiments/run-interactive-audio.ts',
    baseline: {
      planId: CANONICAL_PLAN.id,
      turnCount: baseline.timing.entries.length,
      totalDurationMs: baseline.timing.totalDurationMs,
      qaStatus: baseline.qa.status,
      seed: SESSION_SEED,
      now: FIXED_NOW,
      provider: 'deterministic-offline-tts (provider-independent session layer; any SpeechProvider works)',
    },
    sessions: sessionRecords,
    falsifiers: {
      F1_allResponsesSourceGrounded: Object.values(sessionRecords).every(
        (record) => (record as { proofs: { F1_responseSourceGrounded: boolean } }).proofs.F1_responseSourceGrounded,
      ),
      F2_allOriginalTurnsByteIdentical: Object.values(sessionRecords).every(
        (record) =>
          (record as { proofs: { F2_originalTurnsByteIdentical: { passed: boolean } } }).proofs
            .F2_originalTurnsByteIdentical.passed,
      ),
      F3_allResumeOrdersPreserved: Object.values(sessionRecords).every(
        (record) =>
          (record as { proofs: { F3_resumeOrderPreserved: { passed: boolean } } }).proofs
            .F3_resumeOrderPreserved.passed,
      ),
      F4_sessionDeterministicByteIdentical: byteIdentical && determinism.manifestEqual,
    },
    honestBoundaries: [
      'Listener VOICE capture is UNRESOLVED: interventions are recorded text-scripted stand-ins; no speech-to-intent layer is claimed.',
      'The response plan is intervention-layer constructed — the Director exposes no question-driven single-turn entry point (HANDOFF for TL adjudication); the response compiles through the same W1+W2 validation and the same audio pipeline machinery.',
      'Session media is fingerprinted-not-committed (5-min golden-media precedent).',
      'Lab reproduction evidence — NOT product-parity evidence (AGENTS.md).',
    ],
    architectureDoc: 'docs/audio/interactive-audio-architecture.md',
  };
  writeJson(join(OUT_ROOT, 'summary.json'), summary);

  const allPass = Object.values(summary.falsifiers).every((value) => value === true);
  console.log(`[interactive-01] F1-F4 all pass: ${allPass}`);
  if (!allPass) {
    process.exitCode = 1;
  }
}

await main();
