/**
 * Arm execution pipeline (WFLX-P3B wave 2) — runs one ArmSpec against the
 * REAL merged pipelines and persists the deterministic artifact set.
 *
 * Audio arms run the full W2 pipeline (compileAudioOverview; pure-TS
 * mastering — byte-identical same-seed regeneration is the pinned layer).
 * Video ablation arms run the storyboard layer (compileVideoScenes ->
 * illustration -> render x2 -> timeline -> narration -> runVideoQa): the
 * scene SVG set is the pinned determinism layer per artifacts/video/README
 * (MP4 bytes are encoder-dependent). The EXP-D dual-modality video arm runs
 * the FULL W3 pipeline including composition (Remotion primary), with the
 * MP4 fingerprinted but not committed (golden-media precedent).
 *
 * Consumes worker-owned trees read-only; writes only under artifacts/.
 * No wall-clock enters any persisted byte: every sidecar stamp is EXP_NOW.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  compileAudioOverview,
  type AudioOverviewResult,
} from '../../src/audio';
import { compileOverviewPlan } from '../../src/director/compiler';
import { MarkdownNoteAdapter } from '../../src/source/markdown-note-adapter';
import { DeterministicExtractor } from '../../src/source/graph/deterministic-extractor';
import {
  compileVideoOverview,
  compileVideoScenes,
  findHeadlessBrowser,
  renderStoryboardSvg,
  runVideoQa,
  synthesizePlaceholderNarration,
  type NarrationSegmentTiming,
} from '../../src/video';
import { buildTimeline } from '../../src/compositor/timeline';
import { selectIllustrationProvider } from '../../src/providers/visual/factory';
import type { IllustrationProvider } from '../../src/providers/visual/port';
import type { StoryboardScene, StyleBible } from '../../src/video';
import { stableStringify } from '../../src/audio';
import type { SemanticGraph } from '../../src/contracts';
import type {
  ArmData,
  ArmSpec,
  AudioCanonicalPlanArm,
  AudioDirectorArm,
  AudioFreshChainArm,
  CompileVideoStoryboardResult,
  DualAudioArm,
  DualVideoArm,
  VideoBlockedArm,
  VideoCanonicalPlanArm,
  VideoDirectorArm,
  VideoFreshChainArm,
} from './runner-types';
import {
  EXP_A_AUDIO_SEED,
  EXP_D_SEED,
  EXP_NOW,
  EXP_V_VIDEO_SEED,
  SOURCE_SPLIT_MARKER,
} from './runner-types';
import {
  audioMetricsFor,
  audioQaMetricTable,
  sha256,
  videoMetricsFor,
  videoQaMetricTable,
} from './metrics';
import { CANONICAL_GRAPH, CANONICAL_SOURCE, RAW_NOTE } from './configs';

// ---------------------------------------------------------------------------
// Serialization + persistence helpers
// ---------------------------------------------------------------------------

function writeJson(dir: string, name: string, value: unknown): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), `${stableStringify(value)}\n`, 'utf8');
}

/** The fresh-chain graph is persisted beside the arm outputs so the runner's
 * diff phase can re-read both arms' graphs without re-extracting (and so the
 * mutation-locality evidence is inspectable per arm). */
function persistFreshChainGraph(
  seriesRoot: string,
  runId: string,
  graph: SemanticGraph,
  surfaceRoot: 'audio' | 'video',
): void {
  writeJson(join('artifacts', surfaceRoot, seriesRoot, runId), 'graph.json', graph);
}

function persistAudioRun(dir: string, result: AudioOverviewResult): void {
  writeJson(dir, 'plan.json', result.plan);
  writeJson(dir, 'artifact.json', result.artifact);
  writeJson(dir, 'qa-report.json', result.qa);
  writeJson(dir, 'timing-manifest.json', result.timing);
}

// ---------------------------------------------------------------------------
// Fresh source chain (adapter -> extractor), optionally with one paragraph
// mutated — the EXP-A-04 / EXP-V-04 control/mutation shape
// ---------------------------------------------------------------------------

interface FreshChain {
  readonly source: Awaited<ReturnType<MarkdownNoteAdapter['ingest']>>;
  readonly graph: Awaited<ReturnType<DeterministicExtractor['extract']>>;
}

async function buildFreshChain(
  runId: string,
  mutation?: { readonly original: string; readonly mutated: string },
): Promise<FreshChain> {
  let content = RAW_NOTE;
  if (mutation !== undefined) {
    if (!content.includes(mutation.original)) {
      throw new Error(`[${runId}] mutation paragraph not found in raw fixture`);
    }
    const mutated = content.replace(mutation.original, mutation.mutated);
    if (mutated === content) throw new Error(`[${runId}] mutation did not apply`);
    content = mutated;
  }
  const adapter = new MarkdownNoteAdapter();
  const extractor = new DeterministicExtractor();
  const source = await adapter.ingest({
    id: 'source-messy-note-redacted',
    label: 'fixtures/reference-messy-note-redacted.md',
    createdAt: EXP_NOW,
    content,
  });
  const graph = await extractor.extract({ sources: [source], options: { createdAt: EXP_NOW } });
  return { source, graph };
}

// ---------------------------------------------------------------------------
// Audio arm execution (full W2 pipeline)
// ---------------------------------------------------------------------------

async function runAudio(
  runId: string,
  experiment: string,
  seriesRoot: string,
  artifactId: string,
  plan: Parameters<typeof compileAudioOverview>[0]['plan'],
  graph: Parameters<typeof compileAudioOverview>[0]['graph'],
  sources: Parameters<typeof compileAudioOverview>[0]['sources'],
  seed: string,
): Promise<{ data: ArmData; result: AudioOverviewResult }> {
  process.stdout.write(`  audio ${runId} ... `);
  const result = await compileAudioOverview({
    plan,
    graph,
    sources,
    options: {
      seed,
      now: EXP_NOW,
      mastering: 'pure-ts',
      artifactId,
      notes: `WFLX-P3B wave-2 integration experiment arm ${runId} (${experiment}); deterministic; fixed now ${EXP_NOW}`,
    },
  });
  const dir = join('artifacts/audio', seriesRoot, runId);
  persistAudioRun(dir, result);
  const metrics = audioMetricsFor(runId, experiment, result, graph);
  const data: ArmData = {
    kind: 'audio',
    runId,
    experiment,
    artifactDir: dir,
    metrics: metrics as unknown as Record<string, unknown>,
    realizedTexts: result.realized.map((turn) => turn.text),
    audioQaMetrics: audioQaMetricTable(result.qa),
  };
  process.stdout.write(`${result.plan.audioTurns.length} turns, qa=${result.qa.status}\n`);
  // Memory discipline (experiments/README.md): drop heavy buffers after persistence.
  return { data, result };
}

// ---------------------------------------------------------------------------
// Storyboard-layer video execution (the pinned determinism layer)
// ---------------------------------------------------------------------------

/** Mirrors compileVideoOverview's needsIllustration (src/video/index.ts). */
function needsIllustration(scene: StoryboardScene): boolean {
  return (
    scene.scene.renderingClass === 'generative' ||
    scene.scene.renderingClass === 'hybrid' ||
    scene.render.layoutKind === 'illustration' ||
    scene.render.layoutKind === 'montage'
  );
}

async function runStoryboardLayer(
  runId: string,
  experiment: string,
  seriesRoot: string,
  plan: Parameters<typeof compileVideoScenes>[0],
  graph: Parameters<typeof compileVideoScenes>[1],
  surfaceSeed: string,
  styleBible?: StyleBible,
): Promise<{ data: ArmData; run: CompileVideoStoryboardResult }> {
  process.stdout.write(`  video ${runId} ... `);
  const compiled = compileVideoScenes(plan, graph, {
    seed: surfaceSeed,
    ...(styleBible !== undefined ? { styleBible } : {}),
  });
  const { storyboard } = compiled;
  const bible = storyboard.styleBible;

  // Illustration fragments for generative/hybrid scenes (offline canonical).
  const illustration: IllustrationProvider = selectIllustrationProvider({ seed: surfaceSeed }).provider;
  const illustrations = new Map<string, string>();
  for (const scene of storyboard.scenes) {
    if (!needsIllustration(scene)) continue;
    const result = await illustration.illustrate({
      sceneId: scene.scene.id,
      brief: scene.render.illustrationBrief,
      style: {
        background: bible.palette.background.value,
        backgroundDeep: bible.palette.backgroundDeep.value,
        surface: bible.palette.surface.value,
        ink: bible.palette.ink.value,
        emphasis: bible.palette.emphasis.value,
        emphasisDeep: bible.palette.emphasisDeep.value,
        emphasisSoft: bible.palette.emphasisSoft.value,
        warning: bible.palette.warning.value,
        accentWarm: bible.palette.accentWarm.value,
        accentGreen: bible.palette.accentGreen.value,
        aiNode: bible.palette.aiNode.value,
        widthPx: bible.layout.widthPx,
        heightPx: bible.layout.heightPx,
      },
      seed: scene.render.seed,
    });
    illustrations.set(scene.scene.id, result.fragment);
  }

  // Deterministic render, twice (in-arm SVG determinism proof).
  const renderInput = { storyboard: storyboard.scenes, styleBible: bible, illustrations };
  const renderA = renderStoryboardSvg(renderInput);
  const renderB = renderStoryboardSvg(renderInput);

  // Timeline + placeholder narration + QA (all deterministic).
  const timeline = buildTimeline(compiled.scenes, { fps: 30 });
  const narrationSpecs = storyboard.scenes.map((scene) => ({
    segmentId: scene.narration.segmentId,
    sceneId: scene.scene.id,
    startSeconds:
      timeline.entries.find((entry) => entry.sceneId === scene.scene.id)?.startSeconds ?? 0,
  }));
  const narration = synthesizePlaceholderNarration(timeline, narrationSpecs);
  const narrationTimings: NarrationSegmentTiming[] = narrationSpecs.map((spec) => ({
    segmentId: spec.segmentId,
    sceneId: spec.sceneId,
    startSeconds: spec.startSeconds,
  }));
  const qa = runVideoQa({
    storyboard,
    renderTraces: renderA.traces,
    timeline,
    narrationTimings,
    styleBible: bible,
    determinismHashA: renderA.combinedSha256,
    determinismHashB: renderB.combinedSha256,
  });

  const run: CompileVideoStoryboardResult = {
    plan,
    graph,
    compiled,
    renderA,
    renderB,
    timeline,
    narration,
    narrationSpecCount: narrationSpecs.length,
    qa,
  };

  // Persist the storyboard-layer sidecar set (no artifact.json — these are
  // storyboard-layer runs, not GeneratedArtifact records; the manifest
  // registry correctly skips them).
  const dir = join('artifacts/video', seriesRoot, runId);
  writeJson(dir, 'plan.json', plan);
  writeJson(dir, 'storyboard.json', {
    meta: storyboard.meta,
    scenes: compiled.scenes,
    issues: compiled.issues,
  });
  writeJson(dir, 'qa-report.json', qa);
  writeJson(dir, 'timeline.json', timeline);
  writeJson(dir, 'determinism.json', {
    sceneSvgCombinedSha256: renderA.combinedSha256,
    sceneSvgCombinedSha256SecondRun: renderB.combinedSha256,
    byteIdentical: renderA.combinedSha256 === renderB.combinedSha256,
    sceneSvgBytes: renderA.renderBytes,
    perSceneSvgSha256: plan.videoScenes.map((scene) => ({
      sceneId: scene.id,
      sha256: sha256(renderA.frames.get(scene.id) ?? ''),
    })),
    narrationWavSha256: sha256(narration.wav),
    narrative:
      'Scene SVGs are the pinned determinism layer (artifacts/video/README.md); this arm runs the ' +
      'storyboard layer only (no composition) — EXP-V ablation convention.',
  });

  const metrics = videoMetricsFor(runId, experiment, run, graph);
  const data: ArmData = {
    kind: 'video',
    runId,
    experiment,
    artifactDir: dir,
    metrics: metrics as unknown as Record<string, unknown>,
    perSceneSvgSha256: metrics.perSceneSvgSha256,
    videoQaMetrics: videoQaMetricTable(qa),
    svgDeterminismProof: {
      hashA: renderA.combinedSha256,
      hashB: renderB.combinedSha256,
      byteIdentical: renderA.combinedSha256 === renderB.combinedSha256,
    },
  };
  process.stdout.write(
    `${plan.videoScenes.length} scenes, svg ${renderA.combinedSha256.slice(0, 12)}, qa=${qa.status}\n`,
  );
  return { data, run };
}

// ---------------------------------------------------------------------------
// Blocked arm (multi-source chain attempt — EXP-V-05/06)
// ---------------------------------------------------------------------------

async function runBlockedArm(arm: VideoBlockedArm): Promise<ArmData> {
  process.stdout.write(`  blocked-attempt ${arm.runId} ... `);
  const idx = RAW_NOTE.indexOf(SOURCE_SPLIT_MARKER);
  if (idx <= 0) throw new Error(`[${arm.runId}] split marker not found in raw fixture`);
  const partA = RAW_NOTE.slice(0, idx);
  const partB = RAW_NOTE.slice(idx);
  const adapter = new MarkdownNoteAdapter();
  const extractor = new DeterministicExtractor();
  const order = arm.runId.endsWith('ba')
    ? ([
        { id: 'source-note-b', content: partB },
        { id: 'source-note-a', content: partA },
      ] as const)
    : ([
        { id: 'source-note-a', content: partA },
        { id: 'source-note-b', content: partB },
      ] as const);
  const sources = await Promise.all(
    order.map((part) =>
      adapter.ingest({
        id: part.id,
        label: `${part.id}.md`,
        createdAt: EXP_NOW,
        content: part.content,
      }),
    ),
  );
  let message = '';
  let succeeded = false;
  try {
    await extractor.extract({ sources, options: { createdAt: EXP_NOW } });
    succeeded = true;
  } catch (error) {
    message = (error as Error).message;
  }
  if (succeeded) {
    // The blocker is GONE — the record must not claim it.
    throw new Error(
      `[${arm.runId}] two-source extraction SUCCEEDED — the W1 blocker no longer reproduces; ` +
        `update the EXP-V-05/06 records`,
    );
  }
  if (!message.includes(arm.expectedBlocker)) {
    throw new Error(
      `[${arm.runId}] unexpected blocker: expected '${arm.expectedBlocker}' in: ${message.slice(0, 200)}`,
    );
  }
  const blockerDetail = [...message.matchAll(/"path":"([^"]+)"/g)]
    .map((match) => match[1] ?? '')
    .filter((path, i, all) => all.indexOf(path) === i)
    .slice(0, 6);
  const blocker = message.split(':')[0] ?? 'unknown error';
  const dir = join('artifacts/video/exp-v', arm.runId);
  writeJson(dir, 'blocker.json', {
    runId: arm.runId,
    attemptedChain: 'MarkdownNoteAdapter (two sources) -> DeterministicExtractor',
    sourceOrder: order.map((part) => part.id),
    splitMarker: SOURCE_SPLIT_MARKER,
    errorHeadline: blocker,
    errorSamplePaths: blockerDetail,
    note: 'Deterministic failure — the contract validator (src/contracts/validation.ts BlockIndex) indexes blocks by block id only, and the adapter numbers blocks per source, so any two-source ingestion collides on b1..bn.',
  });
  process.stdout.write(`blocked: ${blocker}\n`);
  return {
    kind: 'video-blocked',
    runId: arm.runId,
    experiment: arm.experiment,
    artifactDir: dir,
    blocker,
    blockerDetail,
  };
}

// ---------------------------------------------------------------------------
// The arm dispatcher
// ---------------------------------------------------------------------------

export async function executeArm(arm: ArmSpec): Promise<ArmData> {
  switch (arm.kind) {
    case 'audio-director': {
      const a = arm as AudioDirectorArm;
      const plan = compileOverviewPlan({
        ...a.request,
        sources: [CANONICAL_SOURCE],
        graph: CANONICAL_GRAPH,
        planId: a.planId,
      });
      const { data } = await runAudio(
        a.runId,
        a.experiment,
        'exp-a-r2',
        a.artifactId,
        plan,
        CANONICAL_GRAPH,
        [CANONICAL_SOURCE],
        EXP_A_AUDIO_SEED,
      );
      return data;
    }
    case 'audio-canonical-plan': {
      const a = arm as AudioCanonicalPlanArm;
      const plan = JSON.parse(readFileSync(a.planFile, 'utf8')) as Parameters<
        typeof compileAudioOverview
      >[0]['plan'];
      const { data } = await runAudio(
        a.runId,
        a.experiment,
        'exp-a-r2',
        a.artifactId,
        plan,
        CANONICAL_GRAPH,
        [CANONICAL_SOURCE],
        EXP_A_AUDIO_SEED,
      );
      return data;
    }
    case 'audio-fresh-chain': {
      const a = arm as AudioFreshChainArm;
      const chain = await buildFreshChain(a.runId, a.mutation);
      const plan = compileOverviewPlan({
        ...a.request,
        sources: [chain.source],
        graph: chain.graph,
        planId: a.planId,
      });
      const { data } = await runAudio(
        a.runId,
        a.experiment,
        'exp-a-r2',
        a.artifactId,
        plan,
        chain.graph,
        [chain.source],
        EXP_A_AUDIO_SEED,
      );
      persistFreshChainGraph('exp-a-r2', a.runId, chain.graph, 'audio');
      return data;
    }
    case 'video-director': {
      const a = arm as VideoDirectorArm;
      const plan = compileOverviewPlan({
        ...a.request,
        sources: [CANONICAL_SOURCE],
        graph: CANONICAL_GRAPH,
        planId: a.planId,
      });
      const { data } = await runStoryboardLayer(
        a.runId,
        a.experiment,
        'exp-v',
        plan,
        CANONICAL_GRAPH,
        a.surfaceSeed ?? EXP_V_VIDEO_SEED,
        a.styleBible,
      );
      return data;
    }
    case 'video-canonical-plan': {
      const a = arm as VideoCanonicalPlanArm;
      const plan = JSON.parse(readFileSync(a.planFile, 'utf8')) as Parameters<
        typeof compileVideoScenes
      >[0];
      const { data } = await runStoryboardLayer(
        a.runId,
        a.experiment,
        'exp-v',
        plan,
        CANONICAL_GRAPH,
        a.surfaceSeed ?? EXP_V_VIDEO_SEED,
        a.styleBible,
      );
      return data;
    }
    case 'video-fresh-chain': {
      const a = arm as VideoFreshChainArm;
      const chain = await buildFreshChain(a.runId, a.mutation);
      const plan = compileOverviewPlan({
        ...a.request,
        sources: [chain.source],
        graph: chain.graph,
        planId: a.planId,
      });
      const { data } = await runStoryboardLayer(
        a.runId,
        a.experiment,
        'exp-v',
        plan,
        chain.graph,
        a.surfaceSeed ?? EXP_V_VIDEO_SEED,
        a.styleBible,
      );
      persistFreshChainGraph('exp-v', a.runId, chain.graph, 'video');
      return data;
    }
    case 'video-blocked':
      return runBlockedArm(arm as VideoBlockedArm);
    case 'dual-audio': {
      const a = arm as DualAudioArm;
      const plan = compileOverviewPlan({
        ...a.request,
        sources: [CANONICAL_SOURCE],
        graph: CANONICAL_GRAPH,
        planId: a.planId,
      });
      const { data } = await runAudio(
        a.runId,
        a.experiment,
        'exp-d',
        a.artifactId,
        plan,
        CANONICAL_GRAPH,
        [CANONICAL_SOURCE],
        EXP_D_SEED,
      );
      return data;
    }
    case 'dual-video': {
      const a = arm as DualVideoArm;
      const plan = compileOverviewPlan({
        ...a.request,
        sources: [CANONICAL_SOURCE],
        graph: CANONICAL_GRAPH,
        planId: a.planId,
      });
      // OOM guard (2026-09-29 station lesson): a full-series invocation holds
      // ~24 arms of garbage when it reaches this arm; Remotion's composition
      // peak (bundler + headless Chromium) then exceeds the 4 GB sandbox and
      // the OOM killer takes the process mid-arm. Force a synchronous full
      // GC first — the D-01-only invocation composes fine, so releasing the
      // prior arms' garbage restores the same memory profile.
      if (typeof Bun !== 'undefined' && typeof Bun.gc === 'function') {
        Bun.gc(true);
      }
      process.stdout.write(`  dual-video ${a.runId} (full pipeline + composition) ... `);
      const browser = findHeadlessBrowser();
      const workDir = mkdtempSync(join(tmpdir(), 'wflx-exp-d-'));
      const output = join(workDir, 'overview.mp4');
      const result = await compileVideoOverview(plan, CANONICAL_GRAPH, {
        output,
        now: EXP_NOW,
        seed: EXP_D_SEED,
        backend: browser !== null ? 'remotion' : 'fallback',
        ...(browser !== null ? { browserExecutable: browser } : {}),
        workDir,
      });
      const mp4 = readFileSync(result.composition.output);
      // Deterministic composition content fingerprint: the RAW MP4 byte hash
      // and size are encoder-nondeterministic across invocations (OBSERVED
      // 2026-09-29: identical inputs on this environment produced differing
      // hashes 09a74dc2… vs 6f0ed0d3… and sizes 30684940 vs 30685256), so the
      // committed outputs pin the COMPOSITION CONTENT (media structure + SVG
      // layer + plan + seed) instead. artifact.json below stays verbatim as
      // the surface-emitted single-run snapshot and is excluded from the
      // output-set digest (runner.ts DIGEST_EXCLUDED).
      const mp4ContentFingerprint = createHash('sha256')
        .update(
          stableStringify({
            media: {
              container: result.artifact.media.container,
              video: result.artifact.media.video,
              audio: result.artifact.media.audio,
              durationSeconds: result.artifact.media.durationSeconds,
            },
            sceneSvgCombinedSha256: result.determinismProof.hashA,
            planId: a.planId,
            seed: EXP_D_SEED,
          }),
        )
        .digest('hex');
      const dir = join('artifacts/video/exp-d', a.runId);
      writeJson(dir, 'plan.json', plan);
      writeJson(dir, 'artifact.json', result.artifact);
      writeJson(dir, 'qa-report.json', result.qa);
      writeJson(dir, 'timeline.json', result.timeline);
      writeJson(dir, 'determinism.json', {
        sceneSvgCombinedSha256: result.determinismProof.hashA,
        sceneSvgCombinedSha256SecondRun: result.determinismProof.hashB,
        byteIdentical:
          result.determinismProof.hashA === result.determinismProof.hashB,
        sceneSvgBytes: result.render.renderBytes,
        mp4ContentFingerprint,
        compositionBackend: browser !== null ? 'remotion' : 'fallback',
        narrative:
          'MP4 composition is fingerprinted by CONTENT (media structure + scene-SVG combined hash + ' +
          'plan + seed) because the raw MP4 byte hash and size are encoder-nondeterministic across ' +
          'invocations on this same environment (OBSERVED 2026-09-29: differing hashes/sizes on ' +
          'identical inputs). artifact.json keeps the surface-emitted single-run media.sha256 snapshot ' +
          'and is excluded from the output-set digest. The pinned reproducibility layers are the ' +
          'scene-SVG determinism hash, the narration WAV hash, and the deterministic metric set.',
      });
      const metrics = videoMetricsFor(
        a.runId,
        a.experiment,
        {
          // Metrics read renderA/narration/timeline/qa only; renderB is
          // redundant here because the in-pipeline proof already ran.
          plan,
          graph: CANONICAL_GRAPH,
          compiled: {
            scenes: result.scenes,
            storyboard: result.storyboard,
            issues: result.compilerIssues,
          },
          renderA: result.render,
          renderB: result.render,
          timeline: result.timeline,
          narration: result.narration,
          narrationSpecCount: result.narrationTimings.length,
          qa: result.qa,
        },
        CANONICAL_GRAPH,
        result.artifact.id,
        mp4ContentFingerprint,
      );
      const data: ArmData = {
        kind: 'dual-video',
        runId: a.runId,
        experiment: a.experiment,
        artifactDir: dir,
        metrics: metrics as unknown as Record<string, unknown>,
        videoQaMetrics: videoQaMetricTable(result.qa),
        determinismProof: {
          hashA: result.determinismProof.hashA,
          hashB: result.determinismProof.hashB,
        },
        mp4ContentFingerprint,
      };
      process.stdout.write(
        `${plan.videoScenes.length} scenes, mp4 ${mp4.byteLength} bytes, qa=${result.qa.status}\n`,
      );
      return data;
    }
  }
}

export { runAudio, runStoryboardLayer, buildFreshChain };
