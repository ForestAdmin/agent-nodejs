import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import AnthropicAdapter from '../src/anthropic-adapter';

jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn(),
}));

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

  describe('bindTools', () => {
    const tools = [{ type: 'function' as const, function: { name: 'my_tool', parameters: {} } }];

    function makeModel() {
      const bindToolsMock = jest.fn().mockReturnThis();

      return { bindTools: bindToolsMock } as any;
    }

    it('should set disable_parallel_tool_use when parallelToolCalls is false', () => {
      const model = makeModel();

      AnthropicAdapter.bindTools(model, tools, {
        toolChoice: 'required',
        parallelToolCalls: false,
      });

      expect(model.bindTools).toHaveBeenCalledWith(tools, {
        tool_choice: { type: 'any', disable_parallel_tool_use: true },
      });
    });

    it('should default to auto with disable_parallel_tool_use when toolChoice undefined', () => {
      const model = makeModel();

      AnthropicAdapter.bindTools(model, tools, { parallelToolCalls: false });

      expect(model.bindTools).toHaveBeenCalledWith(tools, {
        tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      });
    });

    it('should add disable_parallel_tool_use to specific function', () => {
      const model = makeModel();

      AnthropicAdapter.bindTools(model, tools, {
        toolChoice: { type: 'function', function: { name: 'specific_tool' } },
        parallelToolCalls: false,
      });

      expect(model.bindTools).toHaveBeenCalledWith(tools, {
        tool_choice: { type: 'tool', name: 'specific_tool', disable_parallel_tool_use: true },
      });
    });

    it('should pass "none" unchanged when parallelToolCalls is false', () => {
      const model = makeModel();

      AnthropicAdapter.bindTools(model, tools, { toolChoice: 'none', parallelToolCalls: false });

      expect(model.bindTools).toHaveBeenCalledWith(tools, { tool_choice: 'none' });
    });

    it('should not add disable_parallel_tool_use when parallelToolCalls is true', () => {
      const model = makeModel();

      AnthropicAdapter.bindTools(model, tools, {
        toolChoice: 'required',
        parallelToolCalls: true,
      });

      expect(model.bindTools).toHaveBeenCalledWith(tools, { tool_choice: 'any' });
    });

    it('should not add disable_parallel_tool_use when parallelToolCalls is undefined', () => {
      const model = makeModel();

      AnthropicAdapter.bindTools(model, tools, { toolChoice: 'auto' });

      expect(model.bindTools).toHaveBeenCalledWith(tools, { tool_choice: 'auto' });
    });

    it('should convert tool_choice without parallel restriction', () => {
      const model = makeModel();

      AnthropicAdapter.bindTools(model, tools, { toolChoice: 'auto' });
      expect(model.bindTools).toHaveBeenCalledWith(tools, { tool_choice: 'auto' });

      model.bindTools.mockClear();
      AnthropicAdapter.bindTools(model, tools, { toolChoice: 'none' });
      expect(model.bindTools).toHaveBeenCalledWith(tools, { tool_choice: 'none' });

      model.bindTools.mockClear();
      AnthropicAdapter.bindTools(model, tools, { toolChoice: 'required' });
      expect(model.bindTools).toHaveBeenCalledWith(tools, { tool_choice: 'any' });

      model.bindTools.mockClear();
      AnthropicAdapter.bindTools(model, tools, {});
      expect(model.bindTools).toHaveBeenCalledWith(tools, { tool_choice: undefined });
    });
  });
});
