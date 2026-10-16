import type { DispatchBody } from '../src';

import { ProviderDispatcher, RemoteTools, createBaseChatModel } from '../src';
import createOpenAIChatModel from '../src/create-openai-chat-model';

type SentRequest = { url: string; body: Record<string, any> };

const RESPONSES_TEXT_OUTPUT = [
  {
    type: 'message',
    id: 'msg_1',
    role: 'assistant',
    status: 'completed',
    content: [{ type: 'output_text', text: 'It is sunny', annotations: [] }],
  },
];

const RESPONSES_TOOL_CALL_OUTPUT = [
  {
    type: 'function_call',
    id: 'fc_1',
    call_id: 'call_1',
    name: 'get_weather',
    arguments: '{"city":"Paris"}',
    status: 'completed',
  },
];

function buildFakeFetch(
  output: unknown[] = RESPONSES_TEXT_OUTPUT,
  overrides: Record<string, unknown> = {},
) {
  const requests: SentRequest[] = [];

  const fakeFetch = async (url: unknown, init: { body: string }) => {
    const request = { url: String(url), body: JSON.parse(init.body) };
    requests.push(request);

    const payload = request.url.endsWith('/responses')
      ? {
          id: 'resp_1',
          object: 'response',
          created_at: 1,
          model: request.body.model,
          status: 'completed',
          output,
          usage: { input_tokens: 5, output_tokens: 7, total_tokens: 12 },
          ...overrides,
        }
      : {
          id: 'chatcmpl_1',
          object: 'chat.completion',
          created: 1,
          model: request.body.model,
          choices: [
            { index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' },
          ],
        };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return { requests, fakeFetch };
}

const weatherTool = {
  type: 'function' as const,
  function: {
    name: 'get_weather',
    description: 'Get the weather',
    parameters: { type: 'object', properties: { city: { type: 'string' } } },
  },
};

describe('createOpenAIChatModel', () => {
  function build(fields: Record<string, unknown>, output?: unknown[]) {
    const { requests, fakeFetch } = buildFakeFetch(output);
    const model = createOpenAIChatModel({
      apiKey: 'dev',
      maxRetries: 0,
      configuration: { fetch: fakeFetch as never },
      ...fields,
    } as never);

    return { requests, model };
  }

  describe('which API a model goes through', () => {
    it.each(['gpt-6-luna', 'gpt-6-sol', 'gpt-6.1-sol', 'gpt-6-astra'])(
      'sends %s to the Responses API without any opt-in',
      async name => {
        const { requests, model } = build({ model: name });

        await model.invoke('hi');

        expect(requests[0].url).toMatch(/\/v1\/responses$/);
      },
    );

    it('keeps gpt-4o on Chat Completions by default', async () => {
      const { requests, model } = build({ model: 'gpt-4o' });

      await model.invoke('hi');

      expect(requests[0].url).toMatch(/\/v1\/chat\/completions$/);
    });

    it('sends a non-GPT-6 model to the Responses API when the configuration opts in', async () => {
      const { requests, model } = build({ model: 'gpt-4o', useResponsesApi: true });

      await model.invoke('hi');

      expect(requests[0].url).toMatch(/\/v1\/responses$/);
    });

    it('does not mistake a model merely containing gpt-6 for the GPT-6 family', async () => {
      const { requests, model } = build({ model: 'ft:gpt-4o:gpt-60' });

      await model.invoke('hi');

      expect(requests[0].url).toMatch(/\/v1\/chat\/completions$/);
    });
  });

  describe('on the Responses API', () => {
    it.each([
      ['required', 'required'],
      ['any', 'required'],
      ['auto', 'auto'],
      ['none', 'none'],
    ])('sends tool_choice %s as %s', async (toolChoice, expected) => {
      const { requests, model } = build({ model: 'gpt-6-luna' });

      await model.bindTools!([weatherTool], { tool_choice: toolChoice }).invoke('hi');

      expect(requests[0].body.tool_choice).toBe(expected);
    });

    it('sends a named tool_choice as a function selection', async () => {
      const { requests, model } = build({ model: 'gpt-6-luna' });

      await model.bindTools!([weatherTool], {
        tool_choice: { type: 'function', function: { name: 'get_weather' } },
      }).invoke('hi');

      expect(requests[0].body.tool_choice).toEqual({ type: 'function', name: 'get_weather' });
    });

    it('sends no tool_choice when the call does not set one', async () => {
      const { requests, model } = build({ model: 'gpt-6-luna' });

      await model.bindTools!([weatherTool]).invoke('hi');

      expect(requests[0].body).not.toHaveProperty('tool_choice');
    });

    it('sends no tool_choice when the call carries no tool', async () => {
      const { requests, model } = build({ model: 'gpt-6-luna' });

      await model.invoke('hi', { tool_choice: 'required' } as never);

      expect(requests[0].body).not.toHaveProperty('tool_choice');
    });

    it('forwards the configured reasoning effort to a GPT-6 model', async () => {
      const { requests, model } = build({ model: 'gpt-6-luna', reasoning: { effort: 'none' } });

      await model.invoke('hi');

      expect(requests[0].body.reasoning).toEqual({ effort: 'none' });
    });

    it('sends no reasoning when none is configured', async () => {
      const { requests, model } = build({ model: 'gpt-6-luna' });

      await model.invoke('hi');

      expect(requests[0].body).not.toHaveProperty('reasoning');
    });
  });
});

describe('ProviderDispatcher with a Responses API model', () => {
  function buildDispatcher(
    model: string,
    output?: unknown[],
    extra: Record<string, unknown> = {},
    overrides: Record<string, unknown> = {},
  ) {
    const { requests, fakeFetch } = buildFakeFetch(output, overrides);
    const dispatcher = new ProviderDispatcher(
      {
        name: 'luna',
        provider: 'openai',
        model,
        apiKey: 'dev',
        configuration: { fetch: fakeFetch as never },
        ...extra,
      },
      new RemoteTools(),
    );

    return { requests, dispatcher };
  }

  const body = (overrides: Partial<DispatchBody> = {}) =>
    ({
      messages: [{ role: 'user', content: 'weather in Paris?' }],
      ...overrides,
    } as unknown as DispatchBody);

  it('answers in the Chat Completions shape for a text response', async () => {
    const { dispatcher } = buildDispatcher('gpt-6-luna');

    const response = await dispatcher.dispatch(body());

    expect(response).toMatchObject({
      id: 'resp_1',
      object: 'chat.completion',
      model: 'gpt-6-luna',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'It is sunny' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
    });
  });

  it('answers a function call as a Chat Completions tool call', async () => {
    const { dispatcher } = buildDispatcher('gpt-6-luna', RESPONSES_TOOL_CALL_OUTPUT);

    const response = await dispatcher.dispatch(body({ tools: [weatherTool] } as never));

    expect(response.choices[0]).toMatchObject({
      finish_reason: 'tool_calls',
      message: {
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'get_weather', arguments: '{"city":"Paris"}' },
          },
        ],
      },
    });
  });

  it('sends the conversation, the tool and the forced tool choice to the Responses API', async () => {
    const { requests, dispatcher } = buildDispatcher('gpt-6-luna');

    await dispatcher.dispatch(
      body({
        tools: [weatherTool],
        tool_choice: 'required',
        parallel_tool_calls: false,
        messages: [
          { role: 'user', content: 'weather in Paris?' },
          {
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                id: 'call_0',
                type: 'function',
                function: { name: 'get_weather', arguments: '{"city":"Rome"}' },
              },
            ],
          },
          { role: 'tool', tool_call_id: 'call_0', content: 'sunny' },
        ],
      } as never),
    );

    expect(requests[0].url).toMatch(/\/v1\/responses$/);
    expect(requests[0].body).toMatchObject({
      model: 'gpt-6-luna',
      tool_choice: 'required',
      parallel_tool_calls: false,
      tools: [expect.objectContaining({ type: 'function', name: 'get_weather' })],
    });
    expect(requests[0].body.input).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'function_call',
          call_id: 'call_0',
          name: 'get_weather',
          arguments: '{"city":"Rome"}',
        }),
        { type: 'function_call_output', call_id: 'call_0', output: 'sunny' },
      ]),
    );
  });

  it('forwards the configured reasoning effort', async () => {
    const { requests, dispatcher } = buildDispatcher('gpt-6-luna', undefined, {
      reasoning: { effort: 'low' },
    });

    await dispatcher.dispatch(body());

    expect(requests[0].body.reasoning).toEqual({ effort: 'low' });
  });

  it('keeps returning the raw Chat Completions response for a model on Chat Completions', async () => {
    const { requests, dispatcher } = buildDispatcher('gpt-4o');

    const response = await dispatcher.dispatch(body());

    expect(requests[0].url).toMatch(/\/v1\/chat\/completions$/);
    expect(response).toMatchObject({ id: 'chatcmpl_1', object: 'chat.completion' });
  });

  describe('what the Responses API can answer besides a clean completion', () => {
    const dispatchBody = { messages: [{ role: 'user', content: 'hi' }], tools: [weatherTool] };

    it('reports a response cut by max_output_tokens as finish_reason length', async () => {
      const { dispatcher } = buildDispatcher(
        'gpt-6-luna',
        [
          {
            type: 'message',
            id: 'msg_1',
            role: 'assistant',
            status: 'incomplete',
            content: [{ type: 'output_text', text: 'It is sun', annotations: [] }],
          },
        ],
        {},
        { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } },
      );

      const response = await dispatcher.dispatch(dispatchBody as never);

      expect(response.choices[0]).toMatchObject({
        finish_reason: 'length',
        message: { content: 'It is sun' },
      });
    });

    it('reports a function call cut by max_output_tokens as length, not as a finished call', async () => {
      const { dispatcher } = buildDispatcher(
        'gpt-6-luna',
        [
          {
            type: 'function_call',
            id: 'fc_1',
            call_id: 'call_1',
            name: 'get_weather',
            arguments: '{"city":',
            status: 'incomplete',
          },
        ],
        {},
        { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } },
      );

      const response = await dispatcher.dispatch(dispatchBody as never);

      expect(response.choices[0]).toMatchObject({
        finish_reason: 'length',
        message: {
          tool_calls: [
            expect.objectContaining({
              function: expect.objectContaining({ arguments: '{"city":' }),
            }),
          ],
        },
      });
    });

    it('reports a filtered response as finish_reason content_filter', async () => {
      const { dispatcher } = buildDispatcher(
        'gpt-6-luna',
        [],
        {},
        { status: 'incomplete', incomplete_details: { reason: 'content_filter' } },
      );

      const response = await dispatcher.dispatch(dispatchBody as never);

      expect(response.choices[0].finish_reason).toBe('content_filter');
    });

    it('carries the refusal text instead of an empty answer', async () => {
      const { dispatcher } = buildDispatcher('gpt-6-luna', [
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'refusal', refusal: 'I cannot help with that' }],
        },
      ]);

      const response = await dispatcher.dispatch(dispatchBody as never);

      expect(response.choices[0].message).toMatchObject({
        content: null,
        refusal: 'I cannot help with that',
      });
    });

    it('hands a function call with malformed arguments to the caller as a tool call', async () => {
      const { dispatcher } = buildDispatcher('gpt-6-luna', [
        {
          type: 'function_call',
          id: 'fc_1',
          call_id: 'call_1',
          name: 'get_weather',
          arguments: '{"city":',
          status: 'completed',
        },
      ]);

      const response = await dispatcher.dispatch(dispatchBody as never);

      expect(response.choices[0]).toMatchObject({
        finish_reason: 'tool_calls',
        message: {
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"city":' },
            },
          ],
        },
      });
    });

    it('keeps the cached and reasoning token counts the server bills on', async () => {
      const { dispatcher } = buildDispatcher(
        'gpt-6-luna',
        undefined,
        {},
        {
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
            input_tokens_details: { cached_tokens: 4 },
            output_tokens_details: { reasoning_tokens: 12 },
          },
        },
      );

      const response = await dispatcher.dispatch(body());

      expect(response.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        prompt_tokens_details: { cached_tokens: 4 },
        completion_tokens_details: { reasoning_tokens: 12 },
      });
    });

    it('reports the model that served the call and when OpenAI created the response', async () => {
      const { dispatcher } = buildDispatcher(
        'gpt-6-luna',
        undefined,
        {},
        { model: 'gpt-6-luna-2026-09-01', created_at: 1700000000 },
      );

      const response = await dispatcher.dispatch(body());

      expect(response).toMatchObject({ model: 'gpt-6-luna-2026-09-01', created: 1700000000 });
    });
  });

  describe('a model LangChain sends to the Responses API on its own', () => {
    it.each(['gpt-5.6-mini', 'gpt-5.6-luna-2026-08-01'])(
      'answers %s in the Chat Completions shape with its forced tool choice',
      async model => {
        const { requests, dispatcher } = buildDispatcher(model, RESPONSES_TOOL_CALL_OUTPUT);

        const response = await dispatcher.dispatch({
          messages: [{ role: 'user', content: 'hi' }],
          tools: [weatherTool],
          tool_choice: 'required',
        } as never);

        expect(requests[0].url).toMatch(/\/v1\/responses$/);
        expect(requests[0].body.tool_choice).toBe('required');
        expect(response.choices[0].finish_reason).toBe('tool_calls');
      },
    );

    it('answers a configuration asking for reasoning summaries through the Responses API', async () => {
      const { requests, dispatcher } = buildDispatcher('gpt-5', undefined, {
        reasoning: { effort: 'low', summary: 'auto' },
      });

      const response = await dispatcher.dispatch(body());

      expect(requests[0].url).toMatch(/\/v1\/responses$/);
      expect(response.choices[0].message.content).toBe('It is sunny');
    });
  });
});

describe('createBaseChatModel on the Responses API', () => {
  it.each(['gpt-6-luna', 'gpt-5.6-mini'])(
    'turns the forced tool call the executor makes into tool_choice required for %s',
    async model => {
      const { requests, fakeFetch } = buildFakeFetch(RESPONSES_TOOL_CALL_OUTPUT);
      const chatModel = createBaseChatModel({
        name: 'executor',
        provider: 'openai',
        model,
        apiKey: 'dev',
        maxRetries: 0,
        configuration: { fetch: fakeFetch as never },
      } as never);

      const answer = await chatModel.bindTools!([weatherTool], { tool_choice: 'any' }).invoke('hi');

      expect(requests[0].body.tool_choice).toBe('required');
      expect(answer.tool_calls).toEqual([expect.objectContaining({ name: 'get_weather' })]);
    },
  );
});
