import { routeArgsSchema, VALID_ROUTES } from '../../src/schemas/route';

describe('routeArgsSchema', () => {
  describe('ai-query route', () => {
    it('validates a valid ai-query request', () => {
      const result = routeArgsSchema.safeParse({
        route: 'ai-query',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        route: 'ai-query',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      });
    });

    it('validates ai-query with optional fields', () => {
      const result = routeArgsSchema.safeParse({
        route: 'ai-query',
        query: { 'ai-name': 'gpt4' },
        body: {
          messages: [{ role: 'user', content: 'Hello' }],
          tools: [{ type: 'function', function: { name: 'test' } }],
          tool_choice: 'auto',
          parallel_tool_calls: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        route: 'ai-query',
        query: { 'ai-name': 'gpt4' },
        body: {
          messages: [{ role: 'user', content: 'Hello' }],
          tools: [{ type: 'function', function: { name: 'test' } }],
          tool_choice: 'auto',
          parallel_tool_calls: true,
        },
      });
    });

    it('rejects ai-query without body', () => {
      const result = routeArgsSchema.safeParse({
        route: 'ai-query',
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Missing required parameter: body');
    });

    it('rejects ai-query without messages', () => {
      const result = routeArgsSchema.safeParse({
        route: 'ai-query',
        body: {},
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Missing required body parameter: messages');
    });

    it('rejects ai-query with non-boolean parallel_tool_calls', () => {
      const result = routeArgsSchema.safeParse({
        route: 'ai-query',
        body: {
          messages: [{ role: 'user', content: 'Hello' }],
          parallel_tool_calls: 'true',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toContain('parallel_tool_calls');
    });
  });

  describe('invoke-remote-tool route', () => {
    it('validates a valid invoke-remote-tool request', () => {
      const result = routeArgsSchema.safeParse({
        route: 'invoke-remote-tool',
        query: { 'tool-name': 'my-tool' },
        body: { inputs: [{ role: 'user', content: 'test' }] },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        route: 'invoke-remote-tool',
        query: { 'tool-name': 'my-tool' },
        body: { inputs: [{ role: 'user', content: 'test' }] },
      });
    });

    it('rejects invoke-remote-tool without query', () => {
      const result = routeArgsSchema.safeParse({
        route: 'invoke-remote-tool',
        body: { inputs: [] },
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Missing required parameter: query');
    });

    it('rejects invoke-remote-tool without tool-name', () => {
      const result = routeArgsSchema.safeParse({
        route: 'invoke-remote-tool',
        query: {},
        body: { inputs: [] },
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Missing required query parameter: tool-name');
    });

    it('rejects invoke-remote-tool without body', () => {
      const result = routeArgsSchema.safeParse({
        route: 'invoke-remote-tool',
        query: { 'tool-name': 'my-tool' },
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Missing required parameter: body');
    });

    it('rejects invoke-remote-tool without inputs in body', () => {
      const result = routeArgsSchema.safeParse({
        route: 'invoke-remote-tool',
        query: { 'tool-name': 'my-tool' },
        body: {},
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Missing required body parameter: inputs');
    });
  });

  describe('remote-tools route', () => {
    it('validates a valid remote-tools request', () => {
      const result = routeArgsSchema.safeParse({
        route: 'remote-tools',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ route: 'remote-tools' });
    });

    it('validates remote-tools with optional query', () => {
      const result = routeArgsSchema.safeParse({
        route: 'remote-tools',
        query: { 'ai-name': 'gpt4' },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('invalid routes', () => {
    it('rejects unknown routes with helpful message', () => {
      const result = routeArgsSchema.safeParse({
        route: 'unknown-route',
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].code).toBe('invalid_union');
      expect((result.error?.issues[0] as { note?: string }).note).toBe('No matching discriminator');
    });

    it('rejects missing route', () => {
      const result = routeArgsSchema.safeParse({
        body: { messages: [] },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('VALID_ROUTES constant', () => {
    it('exports the valid routes', () => {
      expect(VALID_ROUTES).toEqual(['ai-query', 'invoke-remote-tool', 'remote-tools']);
    });
  });
});
