import type { ChatOpenAIFields } from '@langchain/openai';

import { ChatOpenAI, ChatOpenAIResponses } from '@langchain/openai';

// Chat Completions rejects reasoning_effort alongside function tools on these models.
const RESPONSES_ONLY_MODEL = /^gpt-6(?:[.-]|$)/;

export function usesResponsesApi(fields: Pick<ChatOpenAIFields, 'model' | 'useResponsesApi'>) {
  return Boolean(fields.useResponsesApi) || RESPONSES_ONLY_MODEL.test(fields.model ?? '');
}

function toResponsesToolChoice(toolChoice: unknown): 'auto' | 'none' | 'required' | undefined {
  if (toolChoice === 'any' || toolChoice === 'required') return 'required';
  if (toolChoice === 'auto' || toolChoice === 'none') return toolChoice;

  return undefined;
}

// LangChain drops a string `tool_choice` on the Responses API. Lift this when it handles it.
function restoreToolChoice(responses: ChatOpenAIResponses): ChatOpenAIResponses {
  const invocationParams = responses.invocationParams.bind(responses);

  responses.invocationParams = options => {
    const params = invocationParams(options);

    if (params.tool_choice === undefined && params.tools?.length) {
      params.tool_choice = toResponsesToolChoice(options?.tool_choice);
    }

    return params;
  };

  return responses;
}

export default function createOpenAIChatModel(fields: ChatOpenAIFields): ChatOpenAI {
  if (!usesResponsesApi(fields)) return new ChatOpenAI(fields);

  return new ChatOpenAI({
    ...fields,
    useResponsesApi: true,
    responses: restoreToolChoice(new ChatOpenAIResponses(fields)),
  });
}
