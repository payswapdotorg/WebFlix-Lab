/**
 * Speech provider (WFLX-W2, Stage 2) — provider selection factory.
 *
 * The compile API selects the speech provider by option, with an env-flag
 * override for the optional real adapter:
 *
 *   WFLX_AUDIO_SPEECH_PROVIDER = 'offline' (default) | 'gemini'
 *
 * The default is ALWAYS the offline deterministic adapter: the lab's
 * canonical path needs no network and no credentials. The Gemini adapter is
 * opt-in and requires GEMINI_API_KEY in the environment (injected by TL-side
 * runtime wiring; never committed).
 */

import type { SpeechProvider } from './port';
import { DeterministicOfflineTtsAdapter } from './deterministic-offline';
import { GeminiMultiSpeakerTts } from './gemini-multi-speaker-adapter';

export const SPEECH_PROVIDER_ENV_FLAG = 'WFLX_AUDIO_SPEECH_PROVIDER';

export type SpeechProviderChoice = 'offline' | 'gemini';

export interface SelectSpeechProviderOptions {
  /** Explicit choice; overrides the env flag. Default 'offline'. */
  readonly provider?: SpeechProviderChoice;
  /** Deterministic seed for the offline adapter (required for determinism). */
  readonly seed?: string | number;
  /** Env source; defaults to process.env (injectable for tests). */
  readonly env?: NodeJS.ProcessEnv;
}

export interface SelectedSpeechProvider {
  readonly provider: SpeechProvider;
  readonly choice: SpeechProviderChoice;
}

export function selectSpeechProvider(
  options: SelectSpeechProviderOptions = {},
): SelectedSpeechProvider {
  const env = options.env ?? process.env;
  const choice: SpeechProviderChoice =
    options.provider ??
    ((env[SPEECH_PROVIDER_ENV_FLAG] as SpeechProviderChoice | undefined) ?? 'offline');

  if (choice === 'gemini') {
    // Credentials are read from env inside the adapter (name declared via
    // requiredCredentialKeys; values never logged or committed).
    return { provider: new GeminiMultiSpeakerTts({}, env), choice };
  }
  return {
    provider: new DeterministicOfflineTtsAdapter({
      seed: options.seed !== undefined ? String(options.seed) : undefined,
    }),
    choice: 'offline',
  };
}
