/**
 * OpenAI model prefixes that do NOT support function calling (tools).
 * Unknown models are allowed.
 * @see https://platform.openai.com/docs/guides/function-calling
 */
const OPENAI_MODELS_WITHOUT_TOOLS_SUPPORT = [
  'gpt-4', // Base gpt-4 doesn't honor tool_choice: required
  'text-davinci',
  'davinci',
  'curie',
  'babbage',
  'ada',
];

/**
 * Exceptions to the unsupported list - these models DO support tools
 * even though they start with an unsupported prefix.
 */
const OPENAI_MODELS_EXCEPTIONS = ['gpt-4-turbo', 'gpt-4o', 'gpt-4.1'];

export default function isModelSupportingTools(model: string): boolean {
  const isException = OPENAI_MODELS_EXCEPTIONS.some(
    exception => model === exception || model.startsWith(`${exception}-`),
  );
  if (isException) return true;

  const isKnownUnsupported = OPENAI_MODELS_WITHOUT_TOOLS_SUPPORT.some(
    unsupported => model === unsupported || model.startsWith(`${unsupported}-`),
  );

  return !isKnownUnsupported;
}

/**
 * Validates that a model supports tool calling.
 * @throws {Error} with descriptive message if the model doesn't support tools.
 * @internal Used by Router and Agent for early validation.
 */
export function validateModelSupportsTools(model: string): void {
  if (!isModelSupportingTools(model)) {
    throw new Error(
      `Model '${model}' does not support tools. Please use a model that supports function calling.`,
    );
  }
}
