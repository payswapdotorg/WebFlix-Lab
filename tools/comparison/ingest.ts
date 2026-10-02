/**
 * Comparison-record ingester (WFLX-P3 Deliverable A / EV-023).
 *
 * Folds the EXISTING LAB-series capture estate into the canonical
 * comparison-record schema:
 *   - LAB-01..06 (audio surfaces)  from docs/experiments/records/LAB-0X.yaml
 *                                  + artifacts/reference/lab-0X/artifact.json
 *   - LAB-07..09 (video control/twin/custom-prompt) — same pattern, plus
 *     the committed ASR transcripts where present
 *   - the original Explainer reference artifact + scene atlas from
 *     docs/reference/reference-artifact-manifest.json +
 *     reference/annotations/reference-video-scenes.json
 *
 * HONESTY RULES (work order §2):
 *   - ingestion is from the COMMITTED records only — every number in an
 *     ingested record traces to a LAB record, capture sidecar, the reference
 *     manifest or the scene atlas (the `source` fields carry the pointer);
 *   - NEVER a number that is not present in a committed record;
 *   - missing fields become null — comparisons whose product side does not
 *     exist are recorded by the dimension program as
 *     "COMPARISON PENDING REFERENCE CAPTURE" (an honest gap, never a guess).
 *
 * Determinism: loadEstate() is a pure function of the committed store; the
 * emitted YAML/JSON is byte-reproducible (no wall-clock anywhere).
 *
 * CLI: bun run tools/comparison/ingest.ts
 *   writes docs/experiments/comparisons/estate/*.yaml +
 *         artifacts/reference/comparisons/estate/*.json + index.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COMPARISON_RECORD_TYPE,
  COMPARISON_SCHEMA_VERSION,
  assertRecordValid,
  type ComparisonRecord,
  type EvidenceLabel,
  type Observation,
} from './schema';
import { parseYaml, emitYaml, type YamlValue } from './yaml';

const RECORDS_DIR = 'docs/experiments/records';
const SIDECARS_DIR = 'artifacts/reference';
const MANIFEST_PATH = 'docs/reference/reference-artifact-manifest.json';
const ATLAS_PATH = 'reference/annotations/reference-video-scenes.json';
const DOCS_OUT_DIR = 'docs/experiments/comparisons/estate';
const JSON_OUT_DIR = 'artifacts/reference/comparisons/estate';
const INDEX_PATH = 'artifacts/reference/comparisons/index.json';

const INGEST_OPERATOR = 'wflx-p3';
const INGEST_STAMP = '2026-10-01T20:00:00Z';

export const LAB_IDS = ['LAB-01', 'LAB-02', 'LAB-03', 'LAB-04', 'LAB-05', 'LAB-06', 'LAB-07', 'LAB-08', 'LAB-09', 'LAB-10', 'LAB-11', 'LAB-12'] as const;
export type LabId = (typeof LAB_IDS)[number];

// ---------------------------------------------------------------------------
// Fail-loud accessors over the parsed YAML record maps
// ---------------------------------------------------------------------------

function asMap(value: YamlValue, context: string): { [key: string]: YamlValue } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context}: expected a mapping, got ${JSON.stringify(value)}`);
  }
  return value;
}

function stringOf(map: { [key: string]: YamlValue }, key: string, context: string): string | null {
  const value = map[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`${context}: field ${key} must be a string, got ${typeof value}`);
  }
  return value;
}

function requireString(map: { [key: string]: YamlValue }, key: string, context: string): string {
  const value = stringOf(map, key, context);
  if (value === null) throw new Error(`${context}: required field ${key} missing`);
  return value;
}

function stringListOf(map: { [key: string]: YamlValue }, key: string, context: string): string[] {
  const value = map[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${context}: field ${key} must be a list, got ${typeof value}`);
  }
  return value.map((item, index) => {
    if (typeof item !== 'string') {
      throw new Error(`${context}: ${key}[${index}] must be a string, got ${typeof item}`);
    }
    return item;
  });
}

function stringMapOf(
  map: { [key: string]: YamlValue },
  key: string,
  context: string,
): Record<string, string> | null {
  const value = map[key];
  if (value === undefined || value === null) return null;
  const nested = asMap(value, `${context}.${key}`);
  const out: Record<string, string> = {};
  for (const [nestedKey, nestedValue] of Object.entries(nested)) {
    if (typeof nestedValue !== 'string') {
      throw new Error(`${context}.${key}.${nestedKey} must be a string, got ${typeof nestedValue}`);
    }
    out[nestedKey] = nestedValue;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Structured capture numbers (verbatim from the committed sidecars)
// ---------------------------------------------------------------------------

export interface LabFormatCapture {
  readonly format: string;
  readonly durationSeconds: number;
  readonly voices: number | null;
  readonly sha256: string;
  readonly title: string | null;
  readonly startedUtc: string | null;
  readonly notes: string | null;
}

export interface LabCaptureNumbers {
  readonly id: LabId;
  readonly surface: 'audio' | 'video';
  readonly durationSeconds: number | null;
  readonly hosts: number | null;
  readonly sha256: string | null;
  readonly title: string | null;
  readonly format: string | null;
  readonly lengthSetting: string | null;
  readonly language: string | null;
  readonly sourceFingerprint: string | null;
  readonly capturedUtc: string | null;
  readonly generationWallSeconds: number | null;
  readonly customPrompt: string | null;
  readonly formats: readonly LabFormatCapture[]; // LAB-02 only
  readonly video: { readonly width: number; readonly height: number; readonly fps: number; readonly aspect: string | null } | null;
  readonly audio: { readonly codec: string; readonly sampleRateHz: number; readonly channels: number } | null;
}

interface RawSidecar {
  readonly [key: string]: unknown;
}

function readJson(path: string, context: string): RawSidecar {
  if (!existsSync(path)) {
    throw new Error(`${context}: committed file missing: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as RawSidecar;
}

function num(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context}: expected a finite number, got ${JSON.stringify(value)}`);
  }
  return value;
}

function optNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optStr(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function loadLabCapture(id: LabId): { readonly yaml: { [key: string]: YamlValue }; readonly numbers: LabCaptureNumbers } {
  const yamlPath = join(RECORDS_DIR, `${id}.yaml`);
  if (!existsSync(yamlPath)) throw new Error(`LAB record missing: ${yamlPath}`);
  const yaml = parseYaml(readFileSync(yamlPath, 'utf8'));
  const context = id;
  if (requireString(yaml, 'id', context) !== id) {
    throw new Error(`${context}: record id mismatch`);
  }
  const sidecar = readJson(join(SIDECARS_DIR, id.toLowerCase(), 'artifact.json'), `${context} sidecar`);
  const surface = requireString(yaml, 'surface', context) === 'audio' ? 'audio' : 'video';
  const formats: LabFormatCapture[] = Array.isArray(sidecar['artifacts'])
    ? (sidecar['artifacts'] as unknown[]).map((raw, index) => {
        const entry = asMap(raw as YamlValue, `${context}.artifacts[${index}]`) as unknown as Record<string, unknown>;
        return {
          format: optStr(entry['format']) ?? `artifact-${index}`,
          durationSeconds: num(entry['duration_seconds'], `${context}.artifacts[${index}].duration_seconds`),
          voices: optNum(entry['voices']),
          sha256: optStr(entry['sha256']) ?? '',
          title: optStr(entry['title']),
          startedUtc: optStr(entry['started_utc']),
          notes: optStr(entry['notes']),
        };
      })
    : [];
  const videoRaw = sidecar['video'] as Record<string, unknown> | undefined;
  const audioRaw = sidecar['audio'] as Record<string, unknown> | undefined;
  const video =
    videoRaw !== undefined
      ? {
          width: num(videoRaw['width'], `${context}.video.width`),
          height: num(videoRaw['height'], `${context}.video.height`),
          fps: num(videoRaw['fps'] ?? videoRaw['frame_rate'], `${context}.video.fps`),
          aspect: optStr(videoRaw['aspect']),
        }
      : null;
  const audio =
    audioRaw !== undefined
      ? {
          codec: optStr(audioRaw['codec']) ?? '',
          sampleRateHz: num(audioRaw['sample_rate_hz'] ?? audioRaw['sample_rate'], `${context}.audio.sample_rate`),
          channels: num(audioRaw['channels'], `${context}.audio.channels`),
        }
      : null;
  return {
    yaml,
    numbers: {
      id,
      surface,
      durationSeconds: optNum(sidecar['duration_seconds']),
      hosts: optNum(sidecar['hosts'] ?? sidecar['voices']),
      sha256: optStr(sidecar['sha256']),
      title: optStr(sidecar['title']),
      format: optStr(sidecar['format']),
      lengthSetting: optStr(sidecar['length_setting']),
      language: optStr(sidecar['language']),
      sourceFingerprint: stringOf(yaml, 'source_fingerprint', context),
      capturedUtc: optStr(sidecar['captured_utc']),
      generationWallSeconds: optNum(sidecar['generation_wall_seconds']),
      customPrompt: stringOf(yaml, 'custom_prompt', context),
      formats,
      video,
      audio,
    },
  };
}

// ---------------------------------------------------------------------------
// Estate-capture record construction
// ---------------------------------------------------------------------------

const LABEL_PREFIX = /^(OBSERVED|DOCUMENTED|HYPOTHESIS|REPRODUCED|UNRESOLVED)\b/;

/**
 * Split an estate observation string into (label, text). The label TOKEN is
 * stripped; parenthetical qualifiers and the colon are preserved verbatim
 * ("OBSERVED (duration band): X" -> label OBSERVED, text "(duration band): X").
 */
export function splitObservation(raw: string): { label: EvidenceLabel; text: string } {
  const match = LABEL_PREFIX.exec(raw);
  if (match === null) {
    // Estate records are evidence-labeled by construction; an unlabeled line
    // is an ingestion error, never silently absorbed.
    throw new Error(`estate observation is not evidence-labeled: ${raw.slice(0, 80)}`);
  }
  return { label: match[1] as EvidenceLabel, text: raw.slice(match[0].length).trim() };
}

function observationsOf(yaml: { [key: string]: YamlValue }, context: string, sourcePath: string): Observation[] {
  return stringListOf(yaml, 'observations', context).map((raw) => {
    const { label, text } = splitObservation(raw);
    return { label, text, source: sourcePath };
  });
}

interface EstateRecordInput {
  readonly id: string;
  readonly surface: 'audio' | 'video' | 'cross-modal';
  readonly dimension: string;
  readonly referenceConfig: {
    notebook: string | null;
    format: string | null;
    language: string | null;
    length: string | null;
    visual_style: string | null;
    custom_prompt: string | null;
    other_config: Record<string, string> | null;
  };
  readonly sourceFingerprint: string | null;
  readonly artifactFingerprint: {
    sha256: string | null;
    path: string | null;
    media_present: boolean;
    additional: { label: string; sha256: string; duration_seconds: number | null }[];
    note: string | null;
  };
  readonly capturedUtc: string | null;
  readonly durationSeconds: number | null;
  readonly customPrompt: string | null;
  readonly observations: Observation[];
  readonly annotations: {
    transcript_path: string | null;
    scene_annotation_path: string | null;
    notes: string | null;
  };
  readonly confidence: 'low' | 'medium' | 'high';
  readonly unresolvedBehavior: string[];
  readonly evidencePaths: string[];
}

function buildEstateRecord(input: EstateRecordInput): ComparisonRecord {
  const record: ComparisonRecord = {
    recordType: COMPARISON_RECORD_TYPE,
    schemaVersion: COMPARISON_SCHEMA_VERSION,
    id: input.id,
    kind: 'estate-capture',
    timestamp_utc: INGEST_STAMP,
    operator: INGEST_OPERATOR,
    surface: input.surface,
    dimension: input.dimension,
    reference_config: input.referenceConfig,
    source_fingerprint: input.sourceFingerprint,
    artifact_fingerprint: input.artifactFingerprint,
    captured_utc: input.capturedUtc,
    duration_seconds: input.durationSeconds,
    custom_prompt: input.customPrompt,
    observations: input.observations,
    annotations: input.annotations,
    comparison: { lab_artifact_id: null, lab_pipeline: null, metrics: [] },
    confidence: input.confidence,
    unresolved_behavior: input.unresolvedBehavior,
    tl_hooks: [],
    evidence_paths: input.evidencePaths,
    status: 'ingested',
  };
  assertRecordValid(record);
  return record;
}

function labEstateRecord(id: LabId): ComparisonRecord {
  const { yaml, numbers } = loadLabCapture(id);
  const context = id;
  const yamlPath = `${RECORDS_DIR}/${id}.yaml`;
  const surface = numbers.surface;
  const transcriptPath =
    id === 'LAB-08' || id === 'LAB-09' || id === 'LAB-10' || id === 'LAB-11' || id === 'LAB-12'
      ? `${RECORDS_DIR}/${id}-transcript.txt`
      : null;
  const confidence = requireString(yaml, 'confidence', context);
  if (!['low', 'medium', 'high'].includes(confidence)) {
    throw new Error(`${context}: unknown confidence ${confidence}`);
  }
  const observations = observationsOf(yaml, context, yamlPath);
  const mediaNote =
    surface === 'audio'
      ? 'media git-ignored (LAB-series discipline); sha256 + metadata committed'
      : 'media git-ignored (artifacts/reference/lab-0X/*.mp4); sha256 + metadata committed';
  const artifactPath = stringOf(yaml, 'artifact_under_test', context);
  const additional = numbers.formats.map((format) => ({
    label: `${format.format} (${format.title ?? 'untitled'})`,
    sha256: format.sha256,
    duration_seconds: format.durationSeconds,
  }));
  const sidecarExtra: Observation[] = [];
  if (numbers.generationWallSeconds !== null) {
    sidecarExtra.push({
      label: 'OBSERVED',
      text: `generation wall ${numbers.generationWallSeconds} s (sidecar; wall-clock is not a stable product observable — LAB-08)`,
      source: `${SIDECARS_DIR}/${id.toLowerCase()}/artifact.json`,
    });
  }
  if (numbers.video !== null) {
    sidecarExtra.push({
      label: 'OBSERVED',
      text: `video stream ${numbers.video.width}x${numbers.video.height}${numbers.video.aspect ? ` (${numbers.video.aspect})` : ''} @ ${numbers.video.fps} fps h264; audio ${numbers.audio?.codec ?? '?'} ${numbers.audio?.channels ?? '?'}ch ${numbers.audio?.sampleRateHz ?? '?'} Hz`,
      source: `${SIDECARS_DIR}/${id.toLowerCase()}/artifact.json`,
    });
  }
  if (transcriptPath !== null) {
    if (!existsSync(transcriptPath)) throw new Error(`${context}: transcript missing: ${transcriptPath}`);
    sidecarExtra.push({
      label: 'OBSERVED',
      text: 'full spoken content transcribed via ASR (committed transcript is the content-level record for this capture)',
      source: transcriptPath,
    });
  }
  const dimension =
    surface === 'audio'
      ? `reference.audio.${id.toLowerCase()}`
      : `reference.video.${id.toLowerCase()}`;
  return buildEstateRecord({
    id: `ESTATE-${id}`,
    surface,
    dimension,
    referenceConfig: {
      notebook: stringOf(yaml, 'reference_notebook', context),
      format: stringOf(yaml, 'format', context),
      language: stringOf(yaml, 'language', context),
      length: stringOf(yaml, 'length', context),
      visual_style: stringOf(yaml, 'visual_style', context),
      custom_prompt: stringOf(yaml, 'custom_prompt', context),
      other_config: stringMapOf(yaml, 'other_config', context),
    },
    sourceFingerprint: numbers.sourceFingerprint,
    artifactFingerprint: {
      sha256: numbers.sha256,
      path: artifactPath,
      media_present: false,
      additional,
      note: mediaNote,
    },
    capturedUtc: numbers.capturedUtc,
    durationSeconds: numbers.durationSeconds,
    customPrompt: numbers.customPrompt === '' ? null : numbers.customPrompt,
    observations: [...observations, ...sidecarExtra],
    annotations: {
      transcript_path: transcriptPath,
      scene_annotation_path: null,
      notes:
        id === 'LAB-01'
          ? 'ASR rough transcript sampled 3x150 s at 0:00/9:30/17:30 (z-ai ASR; chunks ephemeral, summarized into the LAB-01 record observations)'
          : null,
    },
    confidence: confidence as 'low' | 'medium' | 'high',
    unresolvedBehavior: stringListOf(yaml, 'differences', context),
    evidencePaths: stringListOf(yaml, 'evidence_paths', context),
  });
}

function explainerEstateRecord(): ComparisonRecord {
  const manifest = readJson(MANIFEST_PATH, 'explainer manifest');
  const atlas = readJson(ATLAS_PATH, 'scene atlas');
  const served = manifest['served_variant'] as Record<string, unknown> | undefined;
  if (served === undefined) throw new Error('explainer manifest: served_variant missing');
  const servedMeta = served['observed_metadata'] as Record<string, unknown> | undefined;
  if (servedMeta === undefined) throw new Error('explainer manifest: served observed_metadata missing');
  const servedVideo = servedMeta['video'] as Record<string, unknown>;
  const servedAudio = servedMeta['audio'] as Record<string, unknown>;
  const atlasCoverage = atlas['coverage'] as Record<string, unknown>;
  const atlasScenes = atlas['scenes'] as unknown[];
  const manifestDuration = num(manifest['duration_seconds'], 'manifest.duration_seconds');
  const servedDuration = num(servedMeta['duration_seconds'], 'served.duration_seconds');
  const observations: Observation[] = [
    {
      label: 'DOCUMENTED',
      text: `origin: ${String(manifest['origin'])}; observed family "${String(manifest['observed_family'])}"; role ${String(manifest['role'])}`,
      source: MANIFEST_PATH,
    },
    {
      label: 'DOCUMENTED',
      text: `original pin sha256 ${String(manifest['sha256'])} (expected ${String(manifest['size_bytes'] ?? '?')} bytes class); served variant sha256 ${String(served['sha256'])} (${String(served['size_bytes'])} bytes) — the exact bytes served by the product differ from the original pin (server-side remux); both authenticated fetches returned byte-identical content (deterministic served variant)`,
      source: MANIFEST_PATH,
    },
    {
      label: 'OBSERVED',
      text: `video ${num(servedVideo['width'], 'video.width')}x${num(servedVideo['height'], 'video.height')} @ ${num(servedVideo['frame_rate'], 'video.fps')} fps h264 (${num(servedVideo['nb_frames'], 'video.nb_frames')} frames served); audio ${String(servedAudio['codec'])} ${num(servedAudio['channels'], 'audio.channels')}ch @ ${num(servedAudio['sample_rate_hz'], 'audio.sr')} Hz`,
      source: MANIFEST_PATH,
    },
    {
      label: 'OBSERVED',
      text: `scene atlas: ${atlasScenes.length} ffmpeg scdet-style segments over the full duration (${String(atlasCoverage['fullDuration'])}, no gaps) — INSTRUMENT TRUTH (cut points), not structural plan scenes; measurement-class note binding: never compared like-for-like with plan scene units`,
      source: ATLAS_PATH,
    },
    {
      label: 'OBSERVED',
      text: 'narration transcribed via ASR in 17 silence-aligned chunks (max 30 s each); narration pauses via ffmpeg silencedetect; scene-cut vs narration-pause alignment recorded per segment',
      source: ATLAS_PATH,
    },
  ];
  return buildEstateRecord({
    id: 'ESTATE-EXPLAINER-001',
    surface: 'video',
    dimension: 'reference.video.explainer-original',
    referenceConfig: {
      notebook: null,
      format: 'Explainer (16:9 narrated illustration — observed family)',
      language: null,
      length: null,
      visual_style: null,
      custom_prompt: null,
      other_config: {
        reference_status: String(manifest['reference_status']),
        binary_import: 'original bytes not committed (65 MB); served variant committed at reference/video/ with full provenance',
      },
    },
    sourceFingerprint: null,
    artifactFingerprint: {
      sha256: String(manifest['sha256']),
      path: String(served['repo_path']),
      media_present: true,
      additional: [
        {
          label: 'served-variant (deterministic; original pin preserved unreplaced)',
          sha256: String(served['sha256']),
          duration_seconds: servedDuration,
        },
      ],
      note: `duration ${manifestDuration} s is the ORIGINAL pin; the served variant runs ${servedDuration} s (server-side remux); captured ${String(served['captured_utc'])} via authenticated replay-browser session`,
    },
    capturedUtc: String(served['captured_utc']),
    durationSeconds: manifestDuration,
    customPrompt: null,
    observations,
    annotations: {
      transcript_path: null,
      scene_annotation_path: ATLAS_PATH,
      notes: `scene atlas method: ${String((atlas['method'] as Record<string, unknown>)['segmentation'])}`,
    },
    confidence: 'high',
    unresolvedBehavior: [
      'operator confirmation of the original (pre-remux) artifact bytes remains pending (EV-002 note in the manifest)',
      'language of the narration is not recorded in the committed manifest/atlas (not asserted here)',
    ],
    evidencePaths: [MANIFEST_PATH, ATLAS_PATH, 'reference/video/ORIGINAL-ARTIFACT.md'],
  });
}

// ---------------------------------------------------------------------------
// Estate loading (the single source of truth for product-side values)
// ---------------------------------------------------------------------------

export interface Estate {
  readonly records: readonly ComparisonRecord[];
  readonly captures: Readonly<Record<LabId, LabCaptureNumbers>>;
  readonly explainer: {
    readonly originalDurationSeconds: number;
    readonly servedDurationSeconds: number;
    readonly originalSha256: string;
    readonly servedSha256: string;
    readonly width: number;
    readonly height: number;
    readonly fps: number;
    readonly audioChannels: number;
    readonly audioSampleRateHz: number;
    readonly atlasSegmentCount: number;
  };
}

export function loadEstate(): Estate {
  const records: ComparisonRecord[] = [];
  const captures: Record<LabId, LabCaptureNumbers> = {} as Record<LabId, LabCaptureNumbers>;
  for (const id of LAB_IDS) {
    records.push(labEstateRecord(id));
    captures[id] = loadLabCapture(id).numbers;
  }
  records.push(explainerEstateRecord());
  const manifest = readJson(MANIFEST_PATH, 'explainer manifest');
  const served = manifest['served_variant'] as Record<string, unknown>;
  const servedMeta = served['observed_metadata'] as Record<string, unknown>;
  const servedVideo = servedMeta['video'] as Record<string, unknown>;
  const servedAudio = servedMeta['audio'] as Record<string, unknown>;
  const atlas = readJson(ATLAS_PATH, 'scene atlas');
  return {
    records,
    captures,
    explainer: {
      originalDurationSeconds: num(manifest['duration_seconds'], 'manifest.duration'),
      servedDurationSeconds: num(servedMeta['duration_seconds'], 'served.duration'),
      originalSha256: String(manifest['sha256']),
      servedSha256: String(served['sha256']),
      width: num(servedVideo['width'], 'video.width'),
      height: num(servedVideo['height'], 'video.height'),
      fps: num(servedVideo['frame_rate'], 'video.fps'),
      audioChannels: num(servedAudio['channels'], 'audio.channels'),
      audioSampleRateHz: num(servedAudio['sample_rate_hz'], 'audio.sr'),
      atlasSegmentCount: (atlas['scenes'] as unknown[]).length,
    },
  };
}

// ---------------------------------------------------------------------------
// CLI emission (deterministic)
// ---------------------------------------------------------------------------

export function ingestMain(): void {
  const estate = loadEstate();
  mkdirSync(DOCS_OUT_DIR, { recursive: true });
  mkdirSync(JSON_OUT_DIR, { recursive: true });
  const index: { generatedBy: string; stamp: string; records: { id: string; kind: string; surface: string; dimension: string; docsPath: string; jsonPath: string }[] } = {
    generatedBy: 'tools/comparison/ingest.ts (WFLX-P3 / EV-023)',
    stamp: INGEST_STAMP,
    records: [],
  };
  for (const record of estate.records) {
    const yamlPath = join(DOCS_OUT_DIR, `${record.id}.yaml`);
    const jsonPath = join(JSON_OUT_DIR, `${record.id}.json`);
    writeFileSync(yamlPath, emitYaml(record as unknown as { readonly [key: string]: YamlValue }), 'utf8');
    writeFileSync(jsonPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    index.records.push({
      id: record.id,
      kind: record.kind,
      surface: record.surface,
      dimension: record.dimension,
      docsPath: yamlPath,
      jsonPath: jsonPath,
    });
  }
  writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  console.log(
    `[ingest] ${estate.records.length} estate records -> ${DOCS_OUT_DIR}/ + ${JSON_OUT_DIR}/ (index: ${INDEX_PATH})`,
  );
}

if (import.meta.main) {
  ingestMain();
}
