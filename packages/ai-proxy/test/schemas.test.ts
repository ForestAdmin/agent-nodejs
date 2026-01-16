import {
  dispatchBodySchema,
  invokeRemoteToolBodySchema,
  invokeToolQuerySchema,
} from '../src/schemas';

describe('schemas', () => {
  describe('dispatchBodySchema', () => {
    describe('when valid', () => {
      it('should pass with system message', () => {
        const body = {
          messages: [{ role: 'system', content: 'You are a helpful assistant' }],
        };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(true);
      });

      it('should pass with user message', () => {
        const body = {
          messages: [{ role: 'user', content: 'Hello' }],
        };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(true);
      });

      it('should pass with user message containing image', () => {
        const body = {
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'What is in this image?' },
                { type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
              ],
            },
          ],
        };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(true);
      });

      it('should pass with assistant message', () => {
        const body = {
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
        };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(true);
      });

      it('should pass with assistant message with tool_calls', () => {
        const body = {
          messages: [
            { role: 'user', content: 'What is the weather?' },
            {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location":"Paris"}' },
                },
              ],
            },
          ],
        };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(true);
      });

      it('should pass with tool message', () => {
        const body = {
          messages: [
            { role: 'user', content: 'What is the weather?' },
            {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{}' },
                },
              ],
            },
            { role: 'tool', content: '{"temperature": 20}', tool_call_id: 'call_123' },
          ],
        };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(true);
      });

      it('should pass with tools and tool_choice', () => {
        const body = {
          messages: [{ role: 'user', content: 'Hello' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get weather for a location',
                parameters: { type: 'object', properties: {} },
              },
            },
          ],
          tool_choice: 'auto',
        };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(true);
      });

      it('should pass with specific tool_choice', () => {
        const body = {
          messages: [{ role: 'user', content: 'Hello' }],
          tool_choice: { type: 'function', function: { name: 'get_weather' } },
        };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(true);
      });
    });

    describe('when invalid', () => {
      it('should fail when messages is missing', () => {
        const body = {};

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(false);
      });

      it('should fail when messages is empty', () => {
        const body = { messages: [] };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error.message).toContain('at least one message');
        }
      });

      it('should fail with invalid role', () => {
        const body = {
          messages: [{ role: 'invalid', content: 'Hello' }],
        };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(false);
      });

      it('should fail when user message has no content', () => {
        const body = {
          messages: [{ role: 'user' }],
        };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(false);
      });

      it('should fail when tool message has no tool_call_id', () => {
        const body = {
          messages: [{ role: 'tool', content: 'result' }],
        };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(false);
      });

      it('should fail with invalid tool definition', () => {
        const body = {
          messages: [{ role: 'user', content: 'Hello' }],
          tools: [{ type: 'invalid' }],
        };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(false);
      });

      it('should fail with invalid tool_choice', () => {
        const body = {
          messages: [{ role: 'user', content: 'Hello' }],
          tool_choice: 'invalid',
        };

        const result = dispatchBodySchema.safeParse(body);

        expect(result.success).toBe(false);
      });
    });
  });

  describe('invokeRemoteToolBodySchema', () => {
    describe('when valid', () => {
      it('should pass with valid inputs', () => {
        const body = {
          inputs: [{ role: 'user', content: 'Hello' }],
        };

        const result = invokeRemoteToolBodySchema.safeParse(body);

        expect(result.success).toBe(true);
      });
    });

    describe('when invalid', () => {
      it('should fail when inputs is missing', () => {
        const body = {};

        const result = invokeRemoteToolBodySchema.safeParse(body);

        expect(result.success).toBe(false);
      });

      it('should fail when inputs is empty', () => {
        const body = { inputs: [] };

        const result = invokeRemoteToolBodySchema.safeParse(body);

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error.message).toContain('at least one message');
        }
      });
    });
  });

  describe('invokeToolQuerySchema', () => {
    describe('when valid', () => {
      it('should pass with tool-name', () => {
        const query = { 'tool-name': 'my-tool' };

        const result = invokeToolQuerySchema.safeParse(query);

        expect(result.success).toBe(true);
      });
    });

    describe('when invalid', () => {
      it('should fail when tool-name is missing', () => {
        const query = {};

        const result = invokeToolQuerySchema.safeParse(query);

        expect(result.success).toBe(false);
      });

      it('should fail when tool-name is empty', () => {
        const query = { 'tool-name': '' };

        const result = invokeToolQuerySchema.safeParse(query);

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error.message).toContain('tool-name is required');
        }
      });
    });
  });
});
