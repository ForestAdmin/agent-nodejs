import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';

import { AIBadRequestError } from '../src/errors';
import { LangChainAdapter } from '../src/langchain-adapter';

describe('LangChainAdapter', () => {
  describe('convertMessages', () => {
    it('should convert each role to the correct LangChain message type', () => {
      const result = LangChainAdapter.convertMessages([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ]);

      expect(result).toEqual([
        expect.any(SystemMessage),
        expect.any(HumanMessage),
        expect.any(AIMessage),
      ]);
      expect(result[0].content).toBe('You are helpful');
      expect(result[1].content).toBe('Hello');
      expect(result[2].content).toBe('Hi there');
    });

    it('should keep multiple system messages as separate SystemMessages', () => {
      const result = LangChainAdapter.convertMessages([
        { role: 'system', content: 'First' },
        { role: 'system', content: 'Second' },
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).toHaveLength(3);
      expect(result[0]).toBeInstanceOf(SystemMessage);
      expect(result[1]).toBeInstanceOf(SystemMessage);
      expect(result[0].content).toBe('First');
      expect(result[1].content).toBe('Second');
    });

    it('should convert assistant tool_calls with parsed JSON arguments', () => {
      const result = LangChainAdapter.convertMessages([
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call_123',
              function: { name: 'get_weather', arguments: '{"city":"Paris"}' },
            },
          ],
        },
        { role: 'tool', content: 'Sunny', tool_call_id: 'call_123' },
      ]);

      expect(result[0]).toBeInstanceOf(AIMessage);
      expect((result[0] as AIMessage).tool_calls).toEqual([
        { id: 'call_123', name: 'get_weather', args: { city: 'Paris' } },
      ]);
      expect(result[1]).toBeInstanceOf(ToolMessage);
    });

    it('should handle content: null on assistant messages', () => {
      const result = LangChainAdapter.convertMessages([
        { role: 'assistant', content: null },
        { role: 'user', content: 'Hello' },
      ]);

      expect(result[0]).toBeInstanceOf(AIMessage);
      expect(result[0].content).toBe('');
    });

    it('should throw AIBadRequestError for tool message without tool_call_id', () => {
      expect(() =>
        LangChainAdapter.convertMessages([{ role: 'tool', content: 'result' }]),
      ).toThrow(new AIBadRequestError('Tool message is missing required "tool_call_id" field.'));
    });

    it('should throw AIBadRequestError for unsupported message role', () => {
      expect(() =>
        LangChainAdapter.convertMessages([{ role: 'unknown', content: 'test' }] as any),
      ).toThrow(
        new AIBadRequestError(
          "Unsupported message role 'unknown'. Expected: system, user, assistant, or tool.",
        ),
      );
    });

    it('should throw AIBadRequestError for invalid JSON in tool_calls arguments', () => {
      expect(() =>
        LangChainAdapter.convertMessages([
          {
            role: 'assistant',
            content: '',
            tool_calls: [
              { id: 'call_1', function: { name: 'my_tool', arguments: 'not-json' } },
            ],
          },
        ]),
      ).toThrow(
        new AIBadRequestError(
          "Invalid JSON in tool_calls arguments for tool 'my_tool': not-json",
        ),
      );
    });
  });

  describe('convertResponse', () => {
    it('should return a complete OpenAI-compatible response', () => {
      const aiMessage = new AIMessage({ content: 'Hello from Claude' });
      Object.assign(aiMessage, {
        id: 'msg_123',
        usage_metadata: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      });

      const response = LangChainAdapter.convertResponse(aiMessage, 'claude-3-5-sonnet-latest');

      expect(response).toEqual(
        expect.objectContaining({
          id: 'msg_123',
          object: 'chat.completion',
          model: 'claude-3-5-sonnet-latest',
          choices: [
            expect.objectContaining({
              index: 0,
              message: expect.objectContaining({
                role: 'assistant',
                content: 'Hello from Claude',
              }),
              finish_reason: 'stop',
            }),
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      );
    });

    it('should default usage to zeros when usage_metadata is missing', () => {
      const response = LangChainAdapter.convertResponse(
        new AIMessage({ content: 'Response' }),
        'claude-3-5-sonnet-latest',
      );

      expect(response.usage).toEqual({
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      });
    });

    it('should return null content for empty string responses', () => {
      const response = LangChainAdapter.convertResponse(
        new AIMessage({ content: '' }),
        'claude-3-5-sonnet-latest',
      );

      expect(response.choices[0].message.content).toBeNull();
    });

    it('should extract text from array content blocks', () => {
      const aiMessage = new AIMessage({
        content: [
          { type: 'text', text: 'Here is the result' },
          { type: 'tool_use', id: 'call_1', name: 'search', input: { q: 'test' } },
        ],
      });
      Object.assign(aiMessage, {
        tool_calls: [{ id: 'call_1', name: 'search', args: { q: 'test' } }],
      });

      const response = LangChainAdapter.convertResponse(aiMessage, 'claude-3-5-sonnet-latest');

      expect(response.choices[0].message.content).toBe('Here is the result');
      expect(response.choices[0].message.tool_calls).toHaveLength(1);
    });

    it('should return null content when array has no text blocks', () => {
      const aiMessage = new AIMessage({
        content: [{ type: 'tool_use', id: 'call_1', name: 'search', input: { q: 'test' } }],
      });
      Object.assign(aiMessage, {
        tool_calls: [{ id: 'call_1', name: 'search', args: { q: 'test' } }],
      });

      const response = LangChainAdapter.convertResponse(aiMessage, 'claude-3-5-sonnet-latest');

      expect(response.choices[0].message.content).toBeNull();
    });

    it('should convert tool_calls to OpenAI format with finish_reason "tool_calls"', () => {
      const aiMessage = new AIMessage({ content: '' });
      Object.assign(aiMessage, {
        tool_calls: [{ id: 'call_456', name: 'search', args: { query: 'test' } }],
      });

      const response = LangChainAdapter.convertResponse(aiMessage, 'claude-3-5-sonnet-latest');

      expect(response.choices[0].message.tool_calls).toEqual([
        {
          id: 'call_456',
          type: 'function',
          function: { name: 'search', arguments: '{"query":"test"}' },
        },
      ]);
      expect(response.choices[0].finish_reason).toBe('tool_calls');
    });

    it('should generate a UUID fallback when tool_call has no id', () => {
      const aiMessage = new AIMessage({ content: '' });
      Object.assign(aiMessage, {
        tool_calls: [{ name: 'search', args: { q: 'test' } }],
      });

      const response = LangChainAdapter.convertResponse(aiMessage, 'claude-3-5-sonnet-latest');

      expect(response.choices[0].message.tool_calls![0].id).toMatch(/^call_/);
    });

    it('should generate a UUID fallback when response has no id', () => {
      const response = LangChainAdapter.convertResponse(
        new AIMessage({ content: 'Hello' }),
        'claude-3-5-sonnet-latest',
      );

      expect(response.id).toMatch(/^msg_/);
    });
  });

  describe('convertToolChoice', () => {
    it('should pass "auto" through unchanged', () => {
      expect(LangChainAdapter.convertToolChoice('auto')).toBe('auto');
    });

    it('should convert "required" to "any"', () => {
      expect(LangChainAdapter.convertToolChoice('required')).toBe('any');
    });

    it('should pass "none" through unchanged', () => {
      expect(LangChainAdapter.convertToolChoice('none')).toBe('none');
    });

    it('should return undefined when no tool_choice', () => {
      expect(LangChainAdapter.convertToolChoice(undefined)).toBeUndefined();
    });

    it('should convert specific function to { type: "tool", name }', () => {
      expect(
        LangChainAdapter.convertToolChoice({
          type: 'function',
          function: { name: 'specific_tool' },
        }),
      ).toEqual({ type: 'tool', name: 'specific_tool' });
    });

    it('should throw AIBadRequestError for unrecognized tool_choice', () => {
      expect(() => LangChainAdapter.convertToolChoice({ type: 'unknown' } as any)).toThrow(
        AIBadRequestError,
      );
    });
  });

  describe('mergeSystemMessages (Anthropic-specific)', () => {
    it('should merge multiple system messages into one placed first', () => {
      const result = LangChainAdapter.mergeSystemMessages([
        { role: 'system', content: 'You are an AI agent.' },
        { role: 'system', content: 'The record belongs to Account.' },
        { role: 'user', content: 'get name' },
      ]);

      expect(result).toEqual([
        { role: 'system', content: 'You are an AI agent.\n\nThe record belongs to Account.' },
        { role: 'user', content: 'get name' },
      ]);
    });

    it('should return messages unchanged when there is only one system message', () => {
      const messages = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hello' },
      ];

      expect(LangChainAdapter.mergeSystemMessages(messages)).toBe(messages);
    });

    it('should return messages unchanged when there are no system messages', () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      expect(LangChainAdapter.mergeSystemMessages(messages)).toBe(messages);
    });
  });

  describe('withParallelToolCallsRestriction (Anthropic-specific)', () => {
    it('should set disable_parallel_tool_use on "any"', () => {
      expect(LangChainAdapter.withParallelToolCallsRestriction('any', false)).toEqual({
        type: 'any',
        disable_parallel_tool_use: true,
      });
    });

    it('should default to auto with disable_parallel_tool_use when undefined', () => {
      expect(LangChainAdapter.withParallelToolCallsRestriction(undefined, false)).toEqual({
        type: 'auto',
        disable_parallel_tool_use: true,
      });
    });

    it('should add disable_parallel_tool_use to specific tool', () => {
      expect(
        LangChainAdapter.withParallelToolCallsRestriction(
          { type: 'tool', name: 'specific_tool' },
          false,
        ),
      ).toEqual({ type: 'tool', name: 'specific_tool', disable_parallel_tool_use: true });
    });

    it('should pass "none" unchanged', () => {
      expect(LangChainAdapter.withParallelToolCallsRestriction('none', false)).toBe('none');
    });

    it('should not modify when parallel_tool_calls is true', () => {
      expect(LangChainAdapter.withParallelToolCallsRestriction('any', true)).toBe('any');
    });

    it('should not modify when parallel_tool_calls is undefined', () => {
      expect(LangChainAdapter.withParallelToolCallsRestriction('auto')).toBe('auto');
    });
  });
});
