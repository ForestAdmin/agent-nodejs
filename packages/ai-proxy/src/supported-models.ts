import type { AiProvider } from './provider';

// ─── OpenAI ──────────────────────────────────────────────────────────────────

/**
 * OpenAI model prefixes that do NOT support tool calls via the chat completions API.
 *
 * Uses prefix matching: model === prefix OR model.startsWith(prefix + '-')
 *
 * Unknown models are allowed by default.
 * If a model fails the integration test, add it here.
 *
 * @see https://platform.openai.com/docs/guides/function-calling
 */
const OPENAI_UNSUPPORTED_PREFIXES = [
  // Legacy models
  'gpt-4', // Base gpt-4 doesn't honor tool_choice: required
  'text-davinci',
  'davinci',
  'curie',
  'babbage',
  'ada',
  // O-series reasoning models - don't support parallel_tool_calls
  'o1',
  'o3',
  'o4',
  // Non-chat model families
  'dall-e',
  'whisper',
  'tts',
  'text-embedding',
  'omni-moderation',
  'chatgpt', // chatgpt-4o-latest, chatgpt-image-latest
  'computer-use', // computer-use-preview
  'gpt-image', // gpt-image-1, gpt-image-1.5
  'gpt-realtime', // gpt-realtime, gpt-realtime-mini
  'gpt-audio', // gpt-audio
  'sora', // sora-2, sora-2-pro
  'codex', // codex-mini-latest
];

/**
 * OpenAI model patterns that do NOT support tool calls.
 * Uses contains matching: model.includes(pattern)
 */
const OPENAI_UNSUPPORTED_PATTERNS = [
  // Non-chat model variants (can appear in the middle of model names)
  '-realtime',
  '-audio',
  '-transcribe',
  '-tts',
  '-search',
  '-codex',
  '-instruct',
  // Models that only support v1/responses, not v1/chat/completions
  '-pro',
  '-deep-research',
];

/**
 * Models that DO support tool calls even though they match an unsupported prefix.
 * These override the OPENAI_UNSUPPORTED_PREFIXES list.
 */
const OPENAI_SUPPORTED_OVERRIDES = ['gpt-4-turbo', 'gpt-4o', 'gpt-4.1'];

function isOpenAIModelSupported(model: string): boolean {
  const matchesPattern = OPENAI_UNSUPPORTED_PATTERNS.some(p => model.includes(p));
  if (matchesPattern) return false;

  const matchesPrefix = OPENAI_UNSUPPORTED_PREFIXES.some(
    prefix => model === prefix || model.startsWith(`${prefix}-`),
  );

  const isOverride = OPENAI_SUPPORTED_OVERRIDES.some(
    override => model === override || model.startsWith(`${override}-`),
  );

  if (matchesPrefix && !isOverride) return false;

  return true;
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

/**
 * Anthropic models that are deprecated or approaching end-of-life.
 *
 * Uses exact matching on the full model ID.
 *
 * @see https://docs.anthropic.com/en/docs/resources/model-deprecations
 */
const ANTHROPIC_UNSUPPORTED_MODELS = [
  'claude-3-7-sonnet-20250219', // EOL 2026-02-19
  'claude-3-haiku-20240307', // EOL 2025-03-14
];

function isAnthropicModelSupported(model: string): boolean {
  return !ANTHROPIC_UNSUPPORTED_MODELS.includes(model);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Checks if a model is compatible with Forest Admin AI.
 *
 * Supported models must handle tool calls and the parallel_tool_calls parameter.
 * Deprecated models approaching end-of-life are rejected.
 */
export default function isModelSupportingTools(model: string, provider?: AiProvider): boolean {
  if (provider === 'anthropic') return isAnthropicModelSupported(model);

  return isOpenAIModelSupported(model);
}
