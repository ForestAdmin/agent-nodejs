import type { AiProvider } from './provider';

// ─── OpenAI ──────────────────────────────────────────────────────────────────
// If a model fails the llm.integration test, add it here.

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

  return !matchesPrefix || isOverride;
}

// ─── Anthropic ───────────────────────────────────────────────────────────────
// If a model fails the llm.integration test, add it here.

const ANTHROPIC_UNSUPPORTED_MODELS = [
  'claude-3-haiku-20240307', // EOL 2025-03-14
  'claude-3-5-haiku-20241022', // EOL 2026-02-19
  'claude-3-5-haiku-latest', // Points to deprecated claude-3-5-haiku-20241022
  'claude-3-7-sonnet-20250219', // EOL 2026-02-19
  'claude-opus-4-20250514', // Requires streaming (non-streaming times out)
  'claude-opus-4-1-20250805', // Requires streaming (non-streaming times out)
];

function isAnthropicModelSupported(model: string): boolean {
  return !ANTHROPIC_UNSUPPORTED_MODELS.includes(model);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export default function isModelSupportingTools(model: string, provider?: AiProvider): boolean {
  if (provider === 'anthropic') return isAnthropicModelSupported(model);

  return isOpenAIModelSupported(model);
}
