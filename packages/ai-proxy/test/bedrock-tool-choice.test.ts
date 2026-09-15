import { ChatBedrockConverse } from '@langchain/aws';

import { createBaseChatModel } from '../src/create-base-chat-model';

// Construction needs a region, never credentials, and tool_choice is resolved client-side in
// invocationParams — so the whole contract is verifiable offline. Everything else in this package
// mocks @langchain/aws, which cannot catch a renamed option or a broken spread order.
const tools = [
  {
    type: 'function' as const,
    function: { name: 'calculate', parameters: { type: 'object', properties: {} } },
  },
];

function toolChoiceFor(model: string) {
  const built = createBaseChatModel({
    name: 'bedrock',
    provider: 'bedrock',
    model,
    region: 'eu-west-3',
  }) as unknown as { invocationParams: (o: unknown) => { toolConfig: { toolChoice: unknown } } };

  return built.invocationParams({ tools, tool_choice: 'any' }).toolConfig.toolChoice;
}

describe('bedrock tool_choice contract', () => {
  it.each([
    'eu.anthropic.claude-sonnet-5-v1:0',
    'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
    'us.anthropic.claude-opus-4-5-v1:0',
    'eu.anthropic.claude-sonnet-4-6-v1:0',
  ])('resolves the forced tool call the executor makes on every AI step: %s', model => {
    expect(toolChoiceFor(model)).toEqual({ any: {} });
  });

  // The negative control: without the override LangChain rejects claude-5 client-side, from a
  // hardcoded family list it has not updated. Delete the override and this test goes green while
  // the one above goes red, which is the pair that documents why the option exists.
  it('fails without the override, which is why supportsToolChoiceValues is set', () => {
    const bare = new ChatBedrockConverse({
      model: 'eu.anthropic.claude-sonnet-5-v1:0',
      region: 'eu-west-3',
    }) as unknown as { invocationParams: (o: unknown) => unknown };

    expect(() => bare.invocationParams({ tools, tool_choice: 'any' })).toThrow(
      /does not currently support 'tool_choice'/,
    );
  });
});
