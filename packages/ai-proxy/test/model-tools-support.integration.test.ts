/**
 * Integration test to verify which OpenAI models actually support tool calling.
 *
 * Run with: OPENAI_API_KEY=xxx yarn workspace @forestadmin/ai-proxy test model-tools-support.integration
 *
 * This test helps maintain an accurate blocklist by testing against the real API.
 * It bypasses the Router validation to test directly with OpenAI.
 */
import OpenAI from 'openai';

const { OPENAI_API_KEY } = process.env;
const describeWithOpenAI = OPENAI_API_KEY ? describe : describe.skip;

// Models to test - includes both potentially supported and unsupported
const MODELS_TO_TEST = [
  // GPT-4o family (should support tools)
  'gpt-4o',
  'gpt-4o-mini',

  // GPT-4.1 family (should support tools)
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',

  // GPT-4 turbo (should support tools)
  'gpt-4-turbo',

  // GPT-4 base (uncertain - test will tell us)
  'gpt-4',

  // GPT-3.5 turbo (uncertain - test will tell us)
  'gpt-3.5-turbo',
];

describeWithOpenAI('Model Tool Support Integration (real API)', () => {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const toolDefinition: OpenAI.ChatCompletionTool = {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Calculate a math expression',
      parameters: {
        type: 'object',
        properties: { expression: { type: 'string' } },
        required: ['expression'],
      },
    },
  };

  describe.each(MODELS_TO_TEST)('Model: %s', model => {
    it('should support tool calling', async () => {
      try {
        const response = await openai.chat.completions.create({
          model,
          messages: [{ role: 'user', content: 'What is 2+2? Use the calculator.' }],
          tools: [toolDefinition],
          tool_choice: 'required',
        });

        // If we get here, the model supports tools
        expect(response.choices[0].finish_reason).toBe('tool_calls');
        expect(response.choices[0].message.tool_calls).toBeDefined();
        expect(response.choices[0].message.tool_calls!.length).toBeGreaterThan(0);

        // eslint-disable-next-line no-console
        console.log(`✅ ${model}: SUPPORTS tools`);
      } catch (error: any) {
        // eslint-disable-next-line no-console
        console.log(`❌ ${model}: FAILED - ${error.message}`);

        // Re-throw to fail the test - we want to see which models fail
        throw error;
      }
    }, 30000);
  });
});
