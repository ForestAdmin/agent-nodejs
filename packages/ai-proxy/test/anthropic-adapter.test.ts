import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import AnthropicAdapter from '../src/anthropic-adapter';

describe('AnthropicAdapter', () => {
  describe('convertMessages', () => {
    it('should merge multiple system messages into one before conversion', () => {
      const result = AnthropicAdapter.convertMessages([
        { role: 'system', content: 'You are an AI agent.' },
        { role: 'system', content: 'The record belongs to Account.' },
        { role: 'user', content: 'get name' },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(SystemMessage);
      expect(result[0].content).toBe('You are an AI agent.\n\nThe record belongs to Account.');
      expect(result[1]).toBeInstanceOf(HumanMessage);
    });

    it('should pass through single system message unchanged', () => {
      const result = AnthropicAdapter.convertMessages([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(SystemMessage);
      expect(result[0].content).toBe('You are helpful');
    });

    it('should handle no system messages', () => {
      const result = AnthropicAdapter.convertMessages([{ role: 'user', content: 'Hello' }]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(HumanMessage);
    });
  });

  describe('convertToolChoice', () => {
    it('should set disable_parallel_tool_use when parallel_tool_calls is false', () => {
      expect(
        AnthropicAdapter.convertToolChoice({
          toolChoice: 'required',
          parallelToolCalls: false,
        }),
      ).toEqual({
        type: 'any',
        disable_parallel_tool_use: true,
      });
    });

    it('should default to auto with disable_parallel_tool_use when toolChoice undefined', () => {
      expect(AnthropicAdapter.convertToolChoice({ parallelToolCalls: false })).toEqual({
        type: 'auto',
        disable_parallel_tool_use: true,
      });
    });

    it('should add disable_parallel_tool_use to specific function', () => {
      expect(
        AnthropicAdapter.convertToolChoice({
          toolChoice: { type: 'function', function: { name: 'specific_tool' } },
          parallelToolCalls: false,
        }),
      ).toEqual({ type: 'tool', name: 'specific_tool', disable_parallel_tool_use: true });
    });

    it('should pass "none" unchanged when parallel_tool_calls is false', () => {
      expect(
        AnthropicAdapter.convertToolChoice({ toolChoice: 'none', parallelToolCalls: false }),
      ).toBe('none');
    });

    it('should not add disable_parallel_tool_use when parallel_tool_calls is true', () => {
      expect(
        AnthropicAdapter.convertToolChoice({
          toolChoice: 'required',
          parallelToolCalls: true,
        }),
      ).toBe('any');
    });

    it('should not add disable_parallel_tool_use when parallel_tool_calls is undefined', () => {
      expect(AnthropicAdapter.convertToolChoice({ toolChoice: 'auto' })).toBe('auto');
    });

    it('should convert tool_choice without parallel restriction', () => {
      expect(AnthropicAdapter.convertToolChoice({ toolChoice: 'auto' })).toBe('auto');
      expect(AnthropicAdapter.convertToolChoice({ toolChoice: 'none' })).toBe('none');
      expect(AnthropicAdapter.convertToolChoice({ toolChoice: 'required' })).toBe('any');
      expect(AnthropicAdapter.convertToolChoice()).toBeUndefined();
    });
  });
});
