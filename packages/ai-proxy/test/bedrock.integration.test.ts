/**
 * End-to-end integration tests against the real Amazon Bedrock Converse API.
 *
 * Requires AWS credentials resolvable by the default chain (IAM role, AWS_ACCESS_KEY_ID /
 * AWS_SECRET_ACCESS_KEY, shared profile) and a region. Tests are skipped when no region is set.
 *
 * Run with: yarn workspace @forestadmin/ai-proxy test bedrock.integration
 */
import type { AiConfiguration } from '../src';

import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
} from '@aws-sdk/client-bedrock';
import { z } from 'zod';

import { AiClient, DynamicStructuredTool } from '../src';
import isModelSupportingTools from '../src/supported-models';

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
const describeWithBedrock = REGION ? describe : describe.skip;

// Claude on Bedrock is the reason this provider exists; it is the one id the suite pins.
const DEFAULT_MODEL =
  process.env.BEDROCK_TEST_MODEL ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

function bedrockConfig(model: string): AiConfiguration {
  return { name: 'test', provider: 'bedrock', model, region: REGION };
}

function calculatorTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'calculate',
    description: 'Calculate a math expression',
    schema: z.object({ result: z.number().describe('The result of the expression') }),
    func: async ({ result }: { result: number }) => String(result),
  });
}

describeWithBedrock('Bedrock Integration (real API)', () => {
  it('completes a simple chat request', async () => {
    const model = new AiClient({ aiConfigurations: [bedrockConfig(DEFAULT_MODEL)] }).getModel();

    const response = await model.invoke([
      { role: 'system', content: 'You are a helpful assistant. Be very concise.' },
      { role: 'user', content: 'What is 2+2? Reply with just the number.' },
    ]);

    expect(String(response.content)).toContain('4');
  }, 60_000);

  // The exact call the workflow executor makes on every AI step (base-step-executor.ts).
  it('forces a tool call with tool_choice: any', async () => {
    const model = new AiClient({ aiConfigurations: [bedrockConfig(DEFAULT_MODEL)] }).getModel();
    const withTools = model.bindTools([calculatorTool()], { tool_choice: 'any' });

    const response = await withTools.invoke([{ role: 'user', content: 'What is 2+2?' }]);

    expect(response.tool_calls?.[0]?.name).toBe('calculate');
  }, 60_000);

  it('surfaces an unknown model as a provider error rather than hanging', async () => {
    const model = new AiClient({
      aiConfigurations: [bedrockConfig('anthropic.does-not-exist-v1:0')],
    }).getModel();

    await expect(model.invoke([{ role: 'user', content: 'hi' }])).rejects.toThrow();
  }, 60_000);

  // Same contract as llm.integration.test.ts for OpenAI/Anthropic: every model the allow/deny list
  // in supported-models.ts lets through must actually honour a forced tool call. A failure here is
  // the signal to add that id to BEDROCK_UNSUPPORTED_MODELS — not to loosen the assertion.
  describe('Model tool support verification', () => {
    let modelsToTest: string[];

    beforeAll(async () => {
      const client = new BedrockClient({ region: REGION });

      const [foundation, profiles] = await Promise.all([
        client.send(new ListFoundationModelsCommand({ byOutputModality: 'TEXT' })),
        client.send(new ListInferenceProfilesCommand({})),
      ]);

      // Models gated behind an inference profile reject their bare id, so they are only reachable
      // through the profile id — hence the union rather than the foundation list alone.
      const onDemand = (foundation.modelSummaries ?? [])
        .filter(m => m.inferenceTypesSupported?.includes('ON_DEMAND'))
        .map(m => m.modelId as string);
      const profileIds = (profiles.inferenceProfileSummaries ?? []).map(
        p => p.inferenceProfileId as string,
      );

      modelsToTest = [...new Set([...onDemand, ...profileIds])]
        .filter(Boolean)
        .filter(id => isModelSupportingTools(id, 'bedrock'))
        .sort();
    }, 60_000);

    it('found models from the Bedrock API', () => {
      expect(modelsToTest.length).toBeGreaterThan(0);
      // eslint-disable-next-line no-console
      console.log(`Testing ${modelsToTest.length} Bedrock models:`, modelsToTest);
    });

    it('all models support forced tool calls', async () => {
      const failures: { model: string; error: string }[] = [];
      const unavailable: { model: string; error: string }[] = [];

      for (const model of modelsToTest) {
        try {
          const withTools = new AiClient({ aiConfigurations: [bedrockConfig(model)] })
            .getModel()
            .bindTools([calculatorTool()], { tool_choice: 'any' });

          // eslint-disable-next-line no-await-in-loop
          const response = await withTools.invoke([{ role: 'user', content: 'What is 2+2?' }]);

          if (!response.tool_calls?.length) {
            failures.push({ model, error: 'no tool call in the response' });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          // Access to a model is granted per account, and throttling is not a capability verdict.
          if (/AccessDenied|not authorized|ThrottlingException|don't have access/i.test(message)) {
            unavailable.push({ model, error: message });
          } else {
            failures.push({ model, error: message });
          }
        }
      }

      if (unavailable.length) {
        // eslint-disable-next-line no-console
        console.log(
          `Skipped ${unavailable.length} models this account cannot invoke:`,
          unavailable,
        );
      }

      expect(failures).toEqual([]);
    }, 900_000);
  });
});
