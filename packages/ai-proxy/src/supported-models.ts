/**
 * OpenAI model prefixes that do NOT support function calling (tools)
 * via the chat completions API.
 *
 * Uses prefix matching: model === prefix OR model.startsWith(prefix + '-')
 *
 * Unknown models are allowed by default.
 * If a model fails the integration test, add it here.
 *
 * @see https://platform.openai.com/docs/guides/function-calling
 */
const OPENAI_MODELS_WITHOUT_TOOLS_SUPPORT_PREFIXES = [
  // Legacy models
  'gpt-4', // Base gpt-4 doesn't honor tool_choice: required
  'text-davinci',
  'davinci',
  'curie',
  'babbage',
  'ada',
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
 * OpenAI model patterns that do NOT support function calling (tools).
 * Uses contains matching: model.includes(pattern)
 */
const OPENAI_MODELS_WITHOUT_TOOLS_SUPPORT_PATTERNS = [
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
 * Exceptions to the unsupported list - these models DO support tools
 * even though they match an unsupported pattern.
 */
const OPENAI_MODELS_EXCEPTIONS = ['gpt-4-turbo', 'gpt-4o', 'gpt-4.1'];

export default function isModelSupportingTools(model: string): boolean {
  // Check pattern matches first (contains) - these NEVER support tools
  const matchesPattern = OPENAI_MODELS_WITHOUT_TOOLS_SUPPORT_PATTERNS.some(pattern =>
    model.includes(pattern),
  );
  if (matchesPattern) return false;

  // Check prefix blacklist
  const matchesPrefix = OPENAI_MODELS_WITHOUT_TOOLS_SUPPORT_PREFIXES.some(
    prefix => model === prefix || model.startsWith(`${prefix}-`),
  );

  // Check exceptions (whitelist specific models from the prefix blacklist)
  const isException = OPENAI_MODELS_EXCEPTIONS.some(
    exception => model === exception || model.startsWith(`${exception}-`),
  );

  // If it matches a prefix but is an exception, it's supported
  if (matchesPrefix && !isException) return false;

  return true;
}
