# Golden Reference Video — Full-Duration Scene Annotation (WFLX-W3)

Machine-readable form: [`reference-video-scenes.json`](./reference-video-scenes.json)
(annotationVersion 1.0.0 — this file and the JSON are curated artifacts; regenerate
instrument data with the commands below, not by re-running a compiler).

Evidence labels per AGENTS.md. Statements about the reference video are OBSERVED
(verified in this lab from the committed binary); vision-model text readings are
treated as instrument output and only clearly-legible designed/structured text is
committed as `exactTexts`. Credential-like in-video values are never transcribed.

## Artifact identity (verified before annotating)

| Field | Value | Evidence |
|---|---|---|
| File | `reference/video/Orchestrating_Agentic_Development__Deconstructing_a_Multi-Agent.mp4` | — |
| SHA-256 (served variant) | `f1241c219a42906d35030eb01f51be490f5ec95ba0682d4b1c629ee88031768b` | OBSERVED (matches manifest `served_variant`) |
| Duration (format) | 415.613968 s | OBSERVED (ffprobe) |
| Video | H.264 High, 1280x720, 30/1 fps, 12,468 frames, yuv420p bt709 | OBSERVED (ffprobe) |
| Audio | AAC LC, mono, 44,100 Hz | OBSERVED (ffprobe) |
| Handler metadata | `ISO Media file produced by Google Inc.` | OBSERVED (ffprobe) |

The original pin (`36485eb8…cdce2`) is preserved in the manifest and is a
different byte identity; the two are never conflated.

## Method (reproducible instrument protocol)

1. **Scene segmentation** — ffmpeg 7.1.5 `select='gt(scene,0.2)'` over a 320x180
   downscale of the full duration:
   `ffmpeg -i REF.mp4 -vf "scale=320:180,select='gt(scene,0.2)',metadata=print:file=cuts.txt" -an -f null -`
   → 48 cut points, 49 segments, zero gaps, zero overlaps, first start 0.000,
   last end 415.614. Comparison thresholds: 0.25 → 46 cuts, 0.30 → 40 cuts
   (monotone; 0.2 chosen for maximum sensitivity, then verified frame-by-frame).
2. **Midpoint frames** — one 640x360 JPEG per segment (ffmpeg fast seek).
3. **Vision-model descriptions** — per-frame structured description (layout,
   typography, diagram pattern, colors, style, role) via the lab's vision
   instrument; hand-curated into the committed fields.
4. **Pixel metrics** — 8-color median-cut quantization shares + Rec.601 mean
   luma per midpoint frame (deterministic).
5. **Motion profile** — 5 fps 160x90 grayscale consecutive-frame mean absolute
   difference over the full duration (2,077 diffs). Interior mean per segment
   classifies motion; the diff profile at each cut classifies transition type
   (single-frame spike = hard cut; ~0.2–0.4 s ramp = crossfade).
6. **Narration** — ASR transcription of the mono track in 17 silence-aligned
   chunks (≤30 s: service limit); narration pauses via
   `silencedetect=noise=-38dB:d=0.45` (54 pauses).
7. **Alignment** — distance from every scene-cut time to the nearest
   narration-pause boundary.

## Global visual grammar (StyleBible source)

- **Background** — dark slate/graphite matte (`#3e4346`/`#3f4447` at 0.33–0.37
  share in the darkest scenes); early hero/paper scenes use light paper tones
  (`#e3e1d6`, `#e9eaea`). OBSERVED.
- **Accent system** — cyan/teal primary (connections, glows, outlines);
  orange/gold secondary (energy/rotation); red reserved for warnings/errors;
  purple/violet for LLM/AI nodes; blue appears in final branding. OBSERVED.
- **Typography** — clean sans-serif, white/light grey; ALL-CAPS headers and
  labels, sentence-case descriptions; crisp vector-like rendering that is
  clearly distinct from stylized text inside illustrations. OBSERVED.
- **Two text classes** — designed/structured text (labels, titles, numbered
  steps, end card) vs inside-illustration stylized pseudo-text (often
  code-like, not reliably legible). OBSERVED. This is the strongest signal for
  the lab's deterministic-vs-generative split: exact labels look structured;
  illustrative text looks generated.
- **Motifs** — central knot/geometric controller mark, hexagonal nodes,
  glowing connection lines, isometric technical hardware, dashed circular
  pathways, split-screen contrasts, timeline rulers. OBSERVED.
- **Composition** — center-weighted; radial/symmetric arrangements for networks
  and loops; generous negative space; split-screen for comparisons (User A/B,
  FLAT vs CLOUD). OBSERVED.
- **Transitions** — 25 crossfades vs 18 hard cuts (of 48; 52% crossfade); the
  remainder are soft changes. Crossfade dominates scene changes. OBSERVED.
- **Motion discipline** — 37/49 segments static at 5 fps sampling; motion
  concentrates in the opening hero and animated-diagram moments; motion
  emphasizes explanation, never continuous drift. OBSERVED.
- **Narration alignment** — scene changes are narration-led: 36/48 cuts (75%)
  within 0.25 s of a narration pause, median distance 0.128 s, 81% within
  0.5 s. Pauses are short (mean 0.74 s, max 3.41 s). OBSERVED.
- **Pacing** — scene lengths min 2.0 s / median ≈ 7.47 s / mean 8.48 s / max
  27.4 s; density follows narration rather than a fixed cadence. OBSERVED.
- **Role distribution** (midpoint sampling) — metaphor-illustration 22,
  architecture-diagram 11, code-panel 5, hero-illustration 3,
  workstation-scene 3, callout 2, data-chart 2, process-flow 1, title-card 1.
  OBSERVED.
- **Recurring exact labels** — the same concept renders with the same label
  across scenes (User A/User B, FLAT DATABASE/CLOUD CLUSTER, OPERATIONAL
  LOOPS), consistent with structured label generation. OBSERVED.
- **Closing card** — product branding: large clean white sans "Gemini
  Notebook" on charcoal, blue-violet gradient logo. OBSERVED.
- **Sensitive region** — code-like credential-warning visuals in segments 11
  and 17 (terminal with token-like value; PERSONAL ACCESS TOKEN plaque).
  Values are not reproduced anywhere in this annotation. OBSERVED.

## Scene index

Compact view; full per-scene fields (layout, diagram pattern, colors, luma,
narration cue, pause distance) are in the JSON.

| # | Start–End (s) | Dur | Transition in | Motion | Visual type | Class | Exact texts (designed/structured) |
|---:|---|---:|---|---|---|---|---|
| 0 | 0.000–10.233 | 10.2 | — (start) | high | hero-illustration | generative | — |
| 1 | 10.233–16.633 | 6.4 | crossfade | static | metaphor-illustration | generative | — |
| 2 | 16.633–20.967 | 4.3 | crossfade | static | workstation-scene | generative | — |
| 3 | 20.967–24.167 | 3.2 | crossfade | static | code-panel | hybrid | — |
| 4 | 24.167–30.233 | 6.1 | crossfade | static | hero-illustration | hybrid | SYSTEM ORCHESTRATOR; STATUS; AUTONOMY: LOCKED; POWER DISTRIBUTION |
| 5 | 30.233–39.833 | 9.6 | hard-cut | static | metaphor-illustration | generative | — |
| 6 | 39.833–43.267 | 3.4 | hard-cut | static | workstation-scene | generative | — |
| 7 | 43.267–50.733 | 7.5 | crossfade | subtle | architecture-diagram | hybrid | ORCHESTRATOR |
| 8 | 50.733–54.967 | 4.2 | hard-cut | static | metaphor-illustration | hybrid | User A; User B; READ; WRITE |
| 9 | 54.967–82.400 | 27.4 | crossfade | static | architecture-diagram | deterministic | — |
| 10 | 82.400–93.367 | 11.0 | crossfade | static | architecture-diagram | deterministic | RIGID STATE MACHINE ASSEMBLY; CIRCUIT # 22.2 B; HEAVY DUTY CHASSIS; LOCKED |
| 11 | 93.367–96.167 | 2.8 | hard-cut | static | code-panel | hybrid | SYSTEM; STATUS: OK (sensitive: value not transcribed) |
| 12 | 96.167–100.800 | 4.6 | crossfade | static | hero-illustration | hybrid | CONTROLLER; DATA |
| 13 | 100.800–109.600 | 8.8 | cut | static | metaphor-illustration | generative | — |
| 14 | 109.600–129.467 | 19.9 | hard-cut | subtle | callout | deterministic | Redis; Composio; Modal |
| 15 | 129.467–136.600 | 7.1 | crossfade | static | architecture-diagram | deterministic | CRITICAL: HIGH-LEVEL ACCESS; SYSTEM STATUS |
| 16 | 136.600–145.633 | 9.0 | hard-cut | moderate | metaphor-illustration | generative | — |
| 17 | 145.633–152.200 | 6.6 | hard-cut | static | code-panel | hybrid | WARNING: DO NOT LOG; PERSONAL ACCESS TOKEN (sensitive: value not transcribed) |
| 18 | 152.200–160.600 | 8.4 | crossfade | static | metaphor-illustration | hybrid | CONFIGURATION FILE; CONTROLLER; CODE |
| 19 | 160.600–163.000 | 2.4 | crossfade | static | architecture-diagram | deterministic | PROJECT BOUNDARIES; ACCESS CONTROL; OPERATIONAL LIMITS; SECURITY PROTOCOLS |
| 20 | 163.000–165.800 | 2.8 | crossfade | static | architecture-diagram | hybrid | Orchestrator Role; Worker Agent |
| 21 | 165.800–172.267 | 6.5 | crossfade | static | metaphor-illustration | generative | — |
| 22 | 172.267–179.000 | 6.7 | hard-cut | static | metaphor-illustration | generative | — |
| 23 | 179.000–185.967 | 7.0 | hard-cut | static | metaphor-illustration | generative | — |
| 24 | 185.967–202.833 | 16.9 | crossfade | static | callout | deterministic | BLOCKED - CAPACITY REACHED; Stale Session; Tech Lead Orchestrator |
| 25 | 202.833–209.867 | 7.0 | crossfade | static | code-panel | generative | — |
| 26 | 209.867–215.533 | 5.7 | crossfade | static | metaphor-illustration | generative | — |
| 27 | 215.533–238.733 | 23.2 | crossfade | subtle | process-flow | deterministic | 1. Monitor; 2. Harvest; 3. Review; 4. Feedback; 5. Dispatch |
| 28 | 238.733–240.733 | 2.0 | crossfade | static | metaphor-illustration | generative | ERROR: CONNECTION LOST |
| 29 | 240.733–243.300 | 2.6 | hard-cut | static | metaphor-illustration | generative | — |
| 30 | 243.300–251.933 | 8.6 | soft-change | static | metaphor-illustration | generative | — |
| 31 | 251.933–260.733 | 8.8 | hard-cut | high | metaphor-illustration | generative | — |
| 32 | 260.733–268.500 | 7.8 | hard-cut | static | code-panel | hybrid | EXECUTE_SEQUENCE: BYPASS_SUC; [ERROR 0x04F: FLOW_INTERRUPT; [CRITICAL FAIL: OVERRIDE DEN |
| 33 | 268.500–283.400 | 14.9 | soft-change | static | architecture-diagram | deterministic | FLAT DATABASE; CLOUD CLUSTER |
| 34 | 283.400–299.567 | 16.2 | hard-cut | subtle | architecture-diagram | deterministic | User A; User B; Ledger; Execution Audits |
| 35 | 299.567–306.433 | 6.9 | crossfade | static | data-chart | hybrid | USER RETENTION; DAU GROWTH |
| 36 | 306.433–314.667 | 8.2 | crossfade | high | metaphor-illustration | generative | +1024 |
| 37 | 314.667–322.600 | 7.9 | hard-cut | static | data-chart | hybrid | 22063; 30000; 23002; 23312 |
| 38 | 322.600–331.400 | 8.8 | hard-cut | static | workstation-scene | hybrid | SECURITY FIREWALL; USER ENGAGEMENT; TREND LINE; RETENTION HEATMAP |
| 39 | 331.400–336.900 | 5.5 | crossfade | static | metaphor-illustration | generative | — |
| 40 | 336.900–344.833 | 7.9 | soft-change | static | architecture-diagram | deterministic | HOSTING PIPELINE UI; SOURCE; commit; BUILD |
| 41 | 344.833–353.700 | 8.9 | crossfade | static | metaphor-illustration | generative | — |
| 42 | 353.700–374.033 | 20.3 | soft-change | subtle | architecture-diagram | deterministic | LLM Endpoints; Dynamic Curation; Cloudflare R2; Object Storage |
| 43 | 374.033–381.900 | 7.9 | hard-cut | high | metaphor-illustration | generative | — |
| 44 | 381.900–387.733 | 5.8 | crossfade | static | workstation-scene | generative | — |
| 45 | 387.733–395.900 | 8.2 | hard-cut | high | metaphor-illustration | generative | — |
| 46 | 395.900–401.967 | 6.1 | crossfade | static | code-panel | hybrid | STRUCTURAL LIMITS.CONF; CPU_QUOTA = 50% FIXED |
| 47 | 401.967–412.600 | 10.6 | crossfade | static | architecture-diagram | hybrid | OPERATIONAL LOOPS; LLM; FEEDBACK ANALYZER; DECISION ENGINE |
| 48 | 412.600–415.614 | 3.0 | hard-cut | subtle | title-card | deterministic | Gemini Notebook |

(`Class` = rendering-class inference for reconstruction: `deterministic` =
exact labels/diagram from structured facts; `generative` = illustration;
`hybrid` = both. Narrative-role mapping to the W1 `VisualType` vocabulary is
curated per scene in the JSON.)

## Reconstruction rules distilled (feed the StyleBible)

1. Exact labels, numbers, node names and step names render as crisp
   structured graphics — never as text inside generated illustration.
2. Illustration carries metaphor, atmosphere and hardware; it never carries
   facts that must be exact.
3. The background is a flat dark graphite/slate field; light paper scenes are
   a deliberate early-beat contrast device.
4. Cyan/teal is the connective/emphasis ink; red is reserved for warning
   semantics; purple marks model/AI nodes.
5. Scene changes are narration-led: cut on or near speech pauses, crossfade
   preferred over hard cut (~52/18 observed).
6. Most scenes are static; motion is spent deliberately (opening hero,
   animated diagrams, closing).
7. Center-weighted composition with generous negative space; split-screen for
   contrasts; radial layouts for loops and networks.
8. Recurring motifs (controller mark, hexagonal nodes, glowing edges,
   timeline rulers) recur with controlled variation.
9. Scene density follows narration (median ≈ 7.5 s), not a fixed cadence.
10. The product closes on a clean branded end card.
