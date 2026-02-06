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
const UNSUPPORTED_MODEL_PREFIXES = [
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
const UNSUPPORTED_MODEL_PATTERNS = [
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
 * These override the UNSUPPORTED_MODEL_PREFIXES list.
 */
const SUPPORTED_MODEL_OVERRIDES = ['gpt-4-turbo', 'gpt-4o', 'gpt-4.1'];

export default function isModelSupportingTools(model: string): boolean {
  // Check pattern matches first (contains) - these NEVER support tools
  const matchesUnsupportedPattern = UNSUPPORTED_MODEL_PATTERNS.some(pattern =>
    model.includes(pattern),
  );
  if (matchesUnsupportedPattern) return false;

  // Check unsupported prefixes
  const matchesUnsupportedPrefix = UNSUPPORTED_MODEL_PREFIXES.some(
    prefix => model === prefix || model.startsWith(`${prefix}-`),
  );

  // Check if model is in the supported overrides list
  const isSupportedOverride = SUPPORTED_MODEL_OVERRIDES.some(
    override => model === override || model.startsWith(`${override}-`),
  );

  // If it matches an unsupported prefix but is not in overrides, reject it
  if (matchesUnsupportedPrefix && !isSupportedOverride) return false;

  return true;
}
