/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — the zero-build web client.
 *
 * Vanilla TypeScript in a module script: no bundler, no framework, no CDN,
 * no npm dependency. The server serves this file type-stripped at /app.js;
 * the root `tsc --noEmit` run typechecks it as-is (types are imported
 * TYPE-ONLY from the studio's HTTP contract in ../api/types.ts and erased
 * at serve time).
 *
 * DOM typing note: the ROOT tsc program deliberately carries NO "DOM" lib —
 * adding it would change `Response`/`BodyInit` resolution and break frozen
 * test files (verified against main). This client therefore declares the
 * exact, narrow DOM surface it uses as LOCAL interfaces below (no ambient
 * globals, zero collision with the frozen program) and reaches the real
 * objects through globalThis. Every line of client code is still fully
 * typechecked by the single root entrypoint.
 *
 * App states (work order §C): loading / error / empty / playing, plus the
 * honest provider state. NO dead controls: everything rendered does exactly
 * what it says; anything not implemented yet (Interactive Audio session UI —
 * W2) is simply not rendered.
 */

import type {
  AudioOverviewMode,
  HealthResponse,
  OverviewResponse,
  SourcesResponse,
  SourceDescriptor,
  TranscriptRow,
} from '../api/types';

// ---------------------------------------------------------------------------
// Gateway routing (TL environment patch, 2026-10-04): the operator console
// exposes ONE external port; the preview gateway routes to the studio's
// fixed port 4313 ONLY when the request carries the XTransformPort query.
// Every fetch/audio URL therefore appends it (harmless on direct localhost
// access — the server ignores unknown query parameters).
// ---------------------------------------------------------------------------

const GATEWAY_PORT_QUERY = 'XTransformPort=4313';

function withGatewayQuery(url: string): string {
  return url + (url.includes('?') ? '&' : '?') + GATEWAY_PORT_QUERY;
}

// ---------------------------------------------------------------------------
// Typed DOM façade (local, minimal, exact)
// ---------------------------------------------------------------------------

interface PointerEventLike {
  readonly clientX: number;
}

interface KeyboardEventLike {
  readonly key: string;
  preventDefault(): void;
}

interface ClassListLike {
  toggle(token: string, force?: boolean): boolean;
  add(...tokens: string[]): void;
  contains(token: string): boolean;
}

interface DomRectLike {
  readonly left: number;
  readonly width: number;
}

/**
 * The union of DOM element members this client uses (element creation is
 * string-tagged, so one structural interface keeps the façade small and
 * honest about what the code actually touches).
 */
interface DomElement {
  textContent: string | null;
  hidden: boolean;
  disabled: boolean;
  title: string;
  className: string;
  value: string;
  checked: boolean;
  type: string;
  name: string;
  dataset: Record<string, string>;
  classList: ClassListLike;
  style: { width: string };
  appendChild<T extends DomElement>(node: T): T;
  addEventListener(type: string, listener: (event: never) => void): void;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getBoundingClientRect(): DomRectLike;
  scrollIntoView(options?: { block?: string }): void;
  querySelectorAll(selector: string): DomElement[];
  querySelector(selector: string): DomElement | null;
  // <audio>
  src: string;
  currentTime: number;
  paused: boolean;
  duration: number;
  load(): void;
  play(): Promise<void>;
  pause(): void;
}

interface DomDocument {
  createElement(tag: string): DomElement;
  getElementById(id: string): DomElement | null;
}

const doc: DomDocument = (globalThis as unknown as { document: DomDocument }).document;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function elementById(id: string): DomElement {
  const found = doc.getElementById(id);
  if (found === null) {
    throw new Error(`studio client: missing element #${id}`);
  }
  return found;
}

function setText(el: DomElement, value: string): void {
  el.textContent = value;
}

function show(el: DomElement, visible: boolean): void {
  el.hidden = !visible;
}

class StudioHttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'StudioHttpError';
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(withGatewayQuery(url), init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : `HTTP ${response.status}`;
    const code =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : 'http-error';
    throw new StudioHttpError(code, message, response.status);
  }
  return body as T;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function shortHash(value: string): string {
  return value.length > 14 ? `${value.slice(0, 14)}…` : value;
}

function formatBytes(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// ---------------------------------------------------------------------------
// Client state
// ---------------------------------------------------------------------------

type Phase = 'empty' | 'loading' | 'ready' | 'error';

interface ClientState {
  sources: readonly SourceDescriptor[];
  sourceId: string | null;
  mode: AudioOverviewMode;
  durationSeconds: number;
  overview: OverviewResponse | null;
  phase: Phase;
}

const DURATION_CHOICES: readonly number[] = [120, 180, 300, 420, 600];

const state: ClientState = {
  sources: [],
  sourceId: null,
  mode: 'deep-dive',
  durationSeconds: 300,
  overview: null,
  phase: 'empty',
};

// ---------------------------------------------------------------------------
// Wired elements
// ---------------------------------------------------------------------------

const providerChipText = elementById('provider-chip-text');
const providerChip = elementById('provider-chip');
const sourceList = elementById('source-list');
const sourcesEmpty = elementById('sources-empty');
const modeSelect = elementById('mode-select');
const durationSelect = elementById('duration-select');
const compileButton = elementById('compile-button');
const overviewEmpty = elementById('overview-empty');
const overviewLoading = elementById('overview-loading');
const overviewError = elementById('overview-error');
const overviewReady = elementById('overview-ready');
const errorTitle = elementById('error-title');
const errorMessage = elementById('error-message');
const errorHint = elementById('error-hint');
const audio = elementById('player');
const playButton = elementById('play-button');
const playIcon = elementById('play-icon');
const progressTrack = elementById('progress-track');
const progressFill = elementById('progress-fill');
const timeCurrent = elementById('time-current');
const timeTotal = elementById('time-total');
const nowPlaying = elementById('now-playing');
const playerError = elementById('player-error');
const playerMode = elementById('player-mode');
const playerProvider = elementById('player-provider');
const transcriptList = elementById('transcript-list');
const metadataList = elementById('metadata-list');
const provenanceList = elementById('provenance-list');

// ---------------------------------------------------------------------------
// Phase management (the four app states)
// ---------------------------------------------------------------------------

function setPhase(phase: Phase): void {
  state.phase = phase;
  show(overviewEmpty, phase === 'empty');
  show(overviewLoading, phase === 'loading');
  show(overviewError, phase === 'error');
  show(overviewReady, phase === 'ready');
  compileButton.disabled = phase === 'loading';
  setText(compileButton, phase === 'loading' ? 'Compiling…' : 'Compile Overview');
}

function showError(title: string, message: string, hint: string): void {
  setText(errorTitle, title);
  setText(errorMessage, message);
  setText(errorHint, hint);
  setPhase('error');
}

// ---------------------------------------------------------------------------
// Boot: health + sources
// ---------------------------------------------------------------------------

async function loadHealth(): Promise<void> {
  try {
    const health = await fetchJson<HealthResponse>('/api/health');
    const gated = health.provider.gated.map((g) => `${g.id.split('-')[0]}: ${g.state}`);
    setText(
      providerChipText,
      `${health.provider.active} · offline (pinned) · live ${gated.join(' / ')}`,
    );
    providerChip.title =
      `${health.provider.note}\n` +
      health.provider.gated
        .map((g) => `${g.id} — ${g.state} (activation: ${g.activation})`)
        .join('\n');
  } catch (error) {
    setText(providerChipText, 'health unavailable');
    providerChip.classList.add('provider-chip-error');
    providerChip.title = error instanceof Error ? error.message : String(error);
  }
}

async function loadSources(): Promise<void> {
  let body: SourcesResponse;
  try {
    body = await fetchJson<SourcesResponse>('/api/sources');
  } catch (error) {
    show(sourcesEmpty, true);
    setText(
      sourcesEmpty,
      `Failed to enumerate sources: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }
  state.sources = body.sources;
  renderSources();
}

function renderSources(): void {
  setText(sourceList, '');
  if (state.sources.length === 0) {
    show(sourcesEmpty, true);
    return;
  }
  for (const source of state.sources) {
    const li = doc.createElement('li');
    li.className = 'source-item';

    const label = doc.createElement('label');
    const radio = doc.createElement('input');
    radio.type = 'radio';
    radio.name = 'source';
    radio.value = source.id;
    radio.checked = state.sourceId === source.id;
    radio.addEventListener('change', () => {
      selectSource(source.id);
    });
    label.appendChild(radio);

    const title = doc.createElement('span');
    title.className = 'source-title';
    setText(title, source.title);
    label.appendChild(title);

    const path = doc.createElement('span');
    path.className = 'source-path mono';
    setText(path, source.label);
    label.appendChild(path);

    const fp = doc.createElement('span');
    fp.className = 'source-fp mono';
    const fpValue = doc.createElement('span');
    fpValue.className = 'fp-value';
    setText(fpValue, `sha256 ${shortHash(source.fingerprint.contentSha256)}`);
    fp.textContent = 'content ';
    fp.appendChild(fpValue);
    fp.title =
      `contentSha256: ${source.fingerprint.contentSha256}\n` +
      `rawSha256: ${source.fingerprint.rawSha256}\n` +
      `textLength: ${source.fingerprint.textLength}`;
    label.appendChild(fp);

    const stats = doc.createElement('span');
    stats.className = 'source-stats';
    setText(
      stats,
      `${source.wordCount} words · ${source.blockCount} blocks · ${source.language} · ${source.adapter}`,
    );
    label.appendChild(stats);

    li.appendChild(label);
    sourceList.appendChild(li);
  }
  if (state.sourceId === null && state.sources.length > 0) {
    const first = state.sources[0];
    if (first !== undefined) selectSource(first.id);
  }
}

function selectSource(sourceId: string): void {
  state.sourceId = sourceId;
  for (const item of sourceList.querySelectorAll('input[type="radio"]')) {
    item.checked = item.value === sourceId;
  }
  renderModeControls();
}

// ---------------------------------------------------------------------------
// Mode + duration controls (the Director's existing surface only)
// ---------------------------------------------------------------------------

function renderModeControls(): void {
  const source = state.sources.find((candidate) => candidate.id === state.sourceId);
  const modes = source?.modes ?? [];
  setText(modeSelect, '');
  for (const info of modes) {
    const option = doc.createElement('option');
    option.value = info.mode;
    option.textContent = `${info.mode} (${info.canonicalDurationSeconds}s${info.default ? ' · default' : ''})`;
    modeSelect.appendChild(option);
  }
  modeSelect.value = state.mode;
  renderDurationChoices();
}

function renderDurationChoices(): void {
  const source = state.sources.find((candidate) => candidate.id === state.sourceId);
  const canonical = source?.modes.find((m) => m.mode === state.mode)?.canonicalDurationSeconds;
  setText(durationSelect, '');
  const choices = new Set<number>(DURATION_CHOICES);
  if (canonical !== undefined) choices.add(canonical);
  for (const seconds of [...choices].sort((a, b) => a - b)) {
    const option = doc.createElement('option');
    option.value = String(seconds);
    option.textContent = `${seconds}s`;
    durationSelect.appendChild(option);
  }
  state.durationSeconds = canonical ?? state.durationSeconds;
  durationSelect.value = String(state.durationSeconds);
}

modeSelect.addEventListener('change', () => {
  state.mode = modeSelect.value as AudioOverviewMode;
  renderDurationChoices();
});

durationSelect.addEventListener('change', () => {
  const parsed = Number.parseInt(durationSelect.value, 10);
  if (Number.isFinite(parsed)) state.durationSeconds = parsed;
});

// ---------------------------------------------------------------------------
// Compile flow
// ---------------------------------------------------------------------------

compileButton.addEventListener('click', () => {
  void compileOverview();
});

async function compileOverview(): Promise<void> {
  if (state.sourceId === null) {
    showError('No source selected', 'Pick a source before compiling.', 'Choose a source on the left.');
    return;
  }
  stopPlayback();
  setPhase('loading');
  try {
    const overview = await fetchJson<OverviewResponse>('/api/overview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceId: state.sourceId,
        mode: state.mode,
        durationSeconds: state.durationSeconds,
      }),
    });
    state.overview = overview;
    renderOverview(overview);
  } catch (error) {
    if (error instanceof StudioHttpError) {
      showError(
        `Compile failed — ${error.code}`,
        error.message,
        error.status >= 500
          ? 'The real pipeline threw; read the message, then retry or adjust mode/duration.'
          : 'Fix the request inputs and compile again.',
      );
    } else {
      showError(
        'Compile failed — network',
        error instanceof Error ? error.message : String(error),
        'Check the studio server is running (bun run studio), then retry.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Overview rendering (player + transcript + metadata + provenance)
// ---------------------------------------------------------------------------

function renderOverview(overview: OverviewResponse): void {
  setPhase('ready');

  audio.src = withGatewayQuery(overview.audioUrl);
  audio.load();
  show(playerError, false);
  setText(playerError, '');

  setText(playerMode, `${overview.plan.mode} · ${overview.plan.targetDurationSeconds}s target`);
  setText(playerProvider, overview.provider);

  renderTranscript(overview);
  renderMetadata(overview);
  renderProvenance(overview);

  updateProgress(0);
  setText(timeTotal, formatClock(overview.timing.totalDurationMs / 1000));
  setText(nowPlaying, 'ready');
  setText(playIcon, '▶');
  playButton.setAttribute('aria-label', 'Play overview');
}

function renderTranscript(overview: OverviewResponse): void {
  setText(transcriptList, '');
  for (const row of overview.transcript) {
    const li = doc.createElement('li');
    li.className = 'turn';
    li.dataset['turnId'] = row.turnId;

    const speaker = doc.createElement('div');
    speaker.className = 'turn-speaker';
    const name = doc.createElement('span');
    name.className = 'turn-name';
    setText(name, row.speakerName);
    const purpose = doc.createElement('span');
    purpose.className = 'turn-purpose';
    setText(purpose, row.purpose);
    const time = doc.createElement('span');
    time.className = 'turn-time';
    setText(time, formatClock(row.startMs / 1000));
    speaker.appendChild(name);
    speaker.appendChild(purpose);
    speaker.appendChild(time);

    const body = doc.createElement('div');
    body.className = 'turn-text';
    setText(body, row.text);

    li.appendChild(speaker);
    li.appendChild(body);
    li.addEventListener('click', () => {
      seekToMs(row.startMs);
    });
    transcriptList.appendChild(li);
  }
}

function kvRow(
  list: DomElement,
  term: string,
  value: string,
  opts: { mono?: boolean; dim?: boolean; title?: string } = {},
): void {
  const dt = doc.createElement('dt');
  setText(dt, term);
  const dd = doc.createElement('dd');
  setText(dd, value);
  if (opts.mono === true) dd.className = 'hash';
  if (opts.dim === true) dd.className = 'dim';
  if (opts.title !== undefined) dd.title = opts.title;
  list.appendChild(dt);
  list.appendChild(dd);
}

function renderMetadata(overview: OverviewResponse): void {
  const plan = overview.plan;
  setText(metadataList, '');
  kvRow(metadataList, 'Mode', plan.mode);
  kvRow(metadataList, 'Language', plan.language);
  kvRow(metadataList, 'Audience', plan.audience);
  kvRow(metadataList, 'Target duration', `${plan.targetDurationSeconds} s`);
  kvRow(metadataList, 'Actual duration', `${(overview.timing.totalDurationMs / 1000).toFixed(1)} s`);
  kvRow(metadataList, 'Turns', String(plan.turnCount));
  kvRow(metadataList, 'Speakers', String(plan.speakerCount));
  kvRow(metadataList, 'Beats', String(plan.beatCount));
  kvRow(metadataList, 'Claims covered', `${plan.coveredClaimCount} covered · ${plan.omittedClaimCount} omitted`);
  kvRow(metadataList, 'Plan id', plan.planId, { mono: true, dim: true, title: plan.planId });
  kvRow(metadataList, 'Plan hash', shortHash(plan.planHash), { mono: true, title: plan.planHash });
  kvRow(metadataList, 'Objective', plan.objective, { dim: true });
}

function renderProvenance(overview: OverviewResponse): void {
  const artifact = overview.artifact;
  setText(provenanceList, '');
  kvRow(provenanceList, 'Artifact id', overview.artifactId, { mono: true, title: overview.artifactId });
  kvRow(provenanceList, 'Evidence class', overview.evidenceClass, { dim: true });
  kvRow(provenanceList, 'Media sha256', shortHash(artifact.media.sha256), {
    mono: true,
    title: artifact.media.sha256,
  });
  kvRow(provenanceList, 'Media size', formatBytes(artifact.media.sizeBytes));
  const mediaAudio = artifact.media.audio;
  kvRow(
    provenanceList,
    'Audio',
    mediaAudio === undefined
      ? '—'
      : `${mediaAudio.sampleRateHz} Hz · ${mediaAudio.channels} ch · ${mediaAudio.codec}`,
  );
  kvRow(provenanceList, 'Speech provider', overview.provider, { dim: true });
  kvRow(provenanceList, 'Mastering', `${overview.mastering} (deterministic)`, { dim: true });
  kvRow(provenanceList, 'Plan id', artifact.planId, { mono: true, dim: true, title: artifact.planId });
  kvRow(provenanceList, 'Created at', artifact.createdAt, { dim: true });
  kvRow(provenanceList, 'Generator', `${artifact.generator.name} · seed ${artifact.generator.seed}`, {
    mono: true,
    dim: true,
    title: artifact.generator.seed,
  });
  kvRow(
    provenanceList,
    'Reproducible',
    artifact.generator.reproducible ? 'yes (byte-identical recompile)' : 'no',
    { dim: true },
  );
  const qa = artifact.qa;
  kvRow(
    provenanceList,
    'QA',
    qa === undefined
      ? 'not evaluated'
      : `${qa.status}${qa.issues.length > 0 ? ` · ${qa.issues.length} issue(s)` : ''}`,
    { dim: true },
  );
  for (const usage of artifact.providers) {
    kvRow(provenanceList, `Stage · ${usage.stage}`, usage.provider, { dim: true });
  }
  kvRow(provenanceList, 'Notes', artifact.notes ?? '—', { dim: true, title: artifact.notes ?? '' });
}

// ---------------------------------------------------------------------------
// Player wiring (play/pause, seek, progress, current-turn highlight)
// ---------------------------------------------------------------------------

playButton.addEventListener('click', () => {
  if (audio.paused) {
    audio.play().catch((error: unknown) => {
      show(playerError, true);
      setText(
        playerError,
        `Playback failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  } else {
    audio.pause();
  }
});

audio.addEventListener('play', () => {
  setText(playIcon, '❚❚');
  playButton.setAttribute('aria-label', 'Pause overview');
  // A successful play clears any earlier playback error (stale-error nit).
  show(playerError, false);
});

audio.addEventListener('pause', () => {
  setText(playIcon, '▶');
  playButton.setAttribute('aria-label', 'Play overview');
});

audio.addEventListener('ended', () => {
  setText(playIcon, '▶');
  setText(nowPlaying, 'ended');
});

audio.addEventListener('error', () => {
  show(playerError, true);
  setText(
    playerError,
    'Playback failed: the audio element could not load the master WAV. Re-compile, then reload if it persists.',
  );
});

audio.addEventListener('timeupdate', () => {
  updateProgress(audio.currentTime);
});

function totalSeconds(): number {
  const total = state.overview?.timing.totalDurationMs;
  return total === undefined ? 0 : total / 1000;
}

function updateProgress(currentSeconds: number): void {
  const total = totalSeconds();
  const fraction = total > 0 ? Math.min(1, currentSeconds / total) : 0;
  progressFill.style.width = `${(fraction * 100).toFixed(2)}%`;
  progressTrack.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
  progressTrack.setAttribute('aria-valuetext', formatClock(currentSeconds));
  setText(timeCurrent, formatClock(currentSeconds));
  highlightCurrentTurn(currentSeconds * 1000);
}

function seekToMs(ms: number): void {
  const total = totalSeconds();
  const clamped = Math.max(0, Math.min(total > 0 ? total - 0.01 : 0, ms / 1000));
  audio.currentTime = clamped;
  updateProgress(clamped);
  if (audio.paused) {
    audio.play().catch((error: unknown) => {
      show(playerError, true);
      setText(
        playerError,
        `Playback failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }
}

progressTrack.addEventListener('pointerdown', (event: PointerEventLike) => {
  const rect = progressTrack.getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  seekToMs(fraction * totalSeconds() * 1000);
});

progressTrack.addEventListener('keydown', (event: KeyboardEventLike) => {
  const step = event.key === 'ArrowLeft' ? -5 : event.key === 'ArrowRight' ? 5 : 0;
  if (step !== 0) {
    event.preventDefault();
    seekToMs((audio.currentTime + step) * 1000);
  } else if (event.key === 'Home') {
    event.preventDefault();
    seekToMs(0);
  } else if (event.key === 'End') {
    event.preventDefault();
    seekToMs((totalSeconds() - 0.05) * 1000);
  }
});

function highlightCurrentTurn(ms: number): void {
  const rows = state.overview?.transcript;
  if (rows === undefined) return;
  let current: TranscriptRow | null = null;
  for (const row of rows) {
    if (row.startMs <= ms) current = row;
    else break;
  }
  for (const li of transcriptList.querySelectorAll('li.turn')) {
    li.classList.toggle('current', current !== null && li.dataset['turnId'] === current.turnId);
  }
  if (current !== null) {
    const li = transcriptList.querySelector(`li.turn[data-turn-id="${current.turnId}"]`);
    li?.scrollIntoView({ block: 'nearest' });
    setText(nowPlaying, `${current.speakerName} · ${current.purpose}`);
  } else {
    setText(nowPlaying, 'ready');
  }
}

function stopPlayback(): void {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

void (async () => {
  setPhase('empty');
  await Promise.all([loadHealth(), loadSources()]);
  renderModeControls();
})();
