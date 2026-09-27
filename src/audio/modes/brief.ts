/**
 * Audio pipeline (WFLX-W2, Stage 2) — Brief mode profile.
 *
 * DOCUMENTED: Brief is one of the four Gemini Notebook audio formats
 * (tests/audio/mode-semantics.md D-01). Lab design targets (H-A-01): compact
 * headline register, denser pacing, shorter gaps, no exploration agenda, no
 * examples unless plan-essential. Exact Brief length semantics are UNRESOLVED
 * (mode-semantics.md U-01); the rate/gap numbers below are lab defaults.
 */

import type { ModeProfile } from './common';

export const BRIEF_PROFILE: ModeProfile = {
  mode: 'brief',
  // Brief is allowed to sound denser (DESIGN.md §5.2 note on the per-mode floor).
  rate: { wordsPerSecond: 2.9, floorMultiplier: 0.85, ceilMultiplier: 1.18 },
  // Gaps shorter (DESIGN.md §4.2).
  gapScale: 0.5,
  enrichedRules: [
    { tag: 'takeaway', purpose: 'conclusion', pattern: /\btakeaway|one thing to remember\b/i },
    { tag: 'acknowledgement', purpose: 'interjection', pattern: /\backnowledge|backchannel|affirm\b/i },
  ],
  stanceRules: [],
  surfaceOverlay: {
    openers: {
      statement: ['In short:', 'The headline:', 'Core point:', 'Simply put:'],
      framing: ['Quick look:', 'Here is the gist:'],
      transition: ['Next:', 'On to', 'Also:'],
      conclusion: ['One takeaway:', 'The upshot:'],
    },
    closers: {
      statement: [],
      conclusion: ['That is the brief.'],
    },
    questionTails: ['is that right?', 'anything more to it?'],
    acknowledgePrefixes: ['Right —', 'Sure —'],
  },
  qa: {
    expectedEnriched: [],
    // H-A-01: no agenda, no connection tissue, examples only if plan-essential.
    discouragedPurposes: [
      { purpose: 'connection', severity: 'warning', note: 'brief plans should not carry connection turns (H-A-01)' },
      { purpose: 'example', severity: 'info', note: 'examples in brief should be plan-essential only (H-A-01)' },
    ],
  },
};
