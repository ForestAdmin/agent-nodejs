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
  '-live',
  '-audio',
  '-transcribe',
  '-tts',
  '-search',
  '-codex',
  '-instruct',
  // Models that only support v1/responses, not v1/chat/completions
  '-pro',
  '-deep-research',
  // Deprecated by OpenAI (return 404 on invocation): gpt-5-chat-latest, gpt-5.1-chat-latest
  '-chat-latest',
];

const OPENAI_UNSUPPORTED_MODELS = [
  'us-40-51r-vm-ev3', // Not a chat model (v1/completions only)
  // Reject reasoning_effort with function tools on v1/chat/completions (v1/responses only)
  'gpt-5.6-luna',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-6-astra',
];

const OPENAI_SUPPORTED_OVERRIDES = ['gpt-4-turbo', 'gpt-4o', 'gpt-4.1'];

function isOpenAIModelSupported(model: string): boolean {
  if (OPENAI_UNSUPPORTED_MODELS.includes(model)) return false;

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
  'claude-3-sonnet-20240229', // EOL 2025-07-21
  'claude-opus-4-20250514', // Requires streaming (non-streaming times out)
  'claude-opus-4-1-20250805', // Requires streaming (non-streaming times out)
];

// Matched as families, not ids: always-on thinking is a property of the line, so every point
// release inherits it and would otherwise turn main red on its own release day.
const ANTHROPIC_UNSUPPORTED_PREFIXES = [
  // Rejects thinking.type 'disabled', and the proxy drops the thinking blocks a reply must carry
  // back for the next turn.
  'claude-fable-5',
];

function isAnthropicModelSupported(model: string): boolean {
  if (ANTHROPIC_UNSUPPORTED_MODELS.includes(model)) return false;

  return !ANTHROPIC_UNSUPPORTED_PREFIXES.some(
    prefix => model === prefix || model.startsWith(`${prefix}-`),
  );
}

// ─── Bedrock ─────────────────────────────────────────────────────────────────
// Allowlist, unlike the two providers above: Bedrock resells hundreds of models and we vouch for
// none of them beyond the Claude lines the integration test actually exercises. Nova, Llama,
// Mistral and Titan are rejected on purpose — several cannot honour the forced tool call every AI
// step makes, and a permissive default would surface that as a failure mid-run rather than a
// refusal at startup.

const BEDROCK_INFERENCE_PROFILE_PREFIXES = [
  'us.',
  'us-gov.',
  'eu.',
  'apac.',
  'jp.',
  'au.',
  'global.',
];

// Anthropic renamed its lines mid-Claude-4: `claude-3-5-sonnet` became `claude-sonnet-4-6`. Both
// spellings are live on Bedrock, and matching only the new one silently excludes every Claude 3.x.
const BEDROCK_SUPPORTED_ANTHROPIC_FAMILIES = [
  'claude-sonnet',
  'claude-haiku',
  'claude-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
  'claude-3-opus',
  'claude-3-5-sonnet',
  'claude-3-5-haiku',
  'claude-3-7-sonnet',
];

const BEDROCK_VERSION_SUFFIX = /-v\d+:\d+(:\w+)?$/;

// `arn:aws:bedrock:<region>:<account>:inference-profile/<profile id>` is a documented modelId, and
// the profile id is the tail — so the ARN form reduces to the id form. Application inference
// profiles carry an opaque id instead and cannot be resolved without calling Bedrock, so they stay
// out of the allowlist.
const BEDROCK_INFERENCE_PROFILE_ARN = /^arn:aws[\w-]*:bedrock:[^:]*:[^:]*:inference-profile\/(.+)$/;

function isBedrockModelSupported(model: string): boolean {
  const arnMatch = BEDROCK_INFERENCE_PROFILE_ARN.exec(model);

  if (arnMatch) return isBedrockModelSupported(arnMatch[1]);

  const profilePrefix = BEDROCK_INFERENCE_PROFILE_PREFIXES.find(prefix => model.startsWith(prefix));
  const vendorId = profilePrefix ? model.slice(profilePrefix.length) : model;
  const separatorIndex = vendorId.indexOf('.');

  if (separatorIndex === -1) return false;

  const vendor = vendorId.slice(0, separatorIndex);
  const vendorModel = vendorId.slice(separatorIndex + 1).replace(BEDROCK_VERSION_SUFFIX, '');

  if (vendor !== 'anthropic') return false;

  const isSupportedFamily = BEDROCK_SUPPORTED_ANTHROPIC_FAMILIES.some(family =>
    vendorModel.startsWith(`${family}-`),
  );

  return isSupportedFamily && isAnthropicModelSupported(vendorModel);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export default function isModelSupportingTools(
  model: string,
  provider: AiProvider = 'openai',
): boolean {
  if (provider === 'anthropic') return isAnthropicModelSupported(model);
  if (provider === 'bedrock') return isBedrockModelSupported(model);

  return isOpenAIModelSupported(model);
}
