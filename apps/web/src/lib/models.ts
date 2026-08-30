/**
 * Single source of truth for supported LLM models.
 * `key` is the TrueForge harness model identifier (used in session create).
 * `label` is the human-readable display name for the UI.
 */
export const MODELS = [
  { key: 'google-gemini/gemini-3-1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
  { key: 'google-gemini/gemini-3-5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { key: 'google-gemini/gemini-3-6-flash',      label: 'Gemini 3.6 Flash' },
] as const;

export type ModelKey = typeof MODELS[number]['key'];

export const DEFAULT_MODEL: ModelKey = 'google-gemini/gemini-3-5-flash-lite';

/** Pass-through — keys are already in TrueForge format. */
export function resolveModelKey(raw?: string | null): ModelKey {
  if (!raw) return DEFAULT_MODEL;
  const found = MODELS.find((m) => m.key === raw);
  return found ? found.key : DEFAULT_MODEL;
}
