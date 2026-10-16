import type { ChatOpenAIFields } from '@langchain/openai';

import { ChatOpenAI, ChatOpenAIResponses } from '@langchain/openai';

// Chat Completions rejects reasoning_effort alongside function tools on these models.
const RESPONSES_ONLY_MODEL = /^gpt-6(?:[.-]|$)/;

function forcesResponsesApi(fields: Pick<ChatOpenAIFields, 'model' | 'useResponsesApi'>) {
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

// LangChain also sends some models to the Responses API on its own (gpt-5.6, reasoning summaries),
// so the delegate it picks is always ours, whatever the route a call ends up taking.
export default function createOpenAIChatModel(fields: ChatOpenAIFields): ChatOpenAI {
  return new ChatOpenAI({
    ...fields,
    ...(forcesResponsesApi(fields) && { useResponsesApi: true }),
    responses: restoreToolChoice(new ChatOpenAIResponses(fields)),
  });
}
