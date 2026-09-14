// Run with: yarn workspace @forestadmin/ai-proxy test bedrock.integration
import type { AiConfiguration } from '../src';

import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
} from '@aws-sdk/client-bedrock';
import { z } from 'zod';

import { AIModelNotAllowlistedError, AiClient, DynamicStructuredTool } from '../src';
import isModelSupportingTools from '../src/supported-models';

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

// Skipping is fine on a laptop and a lie in CI, where it turns "nobody configured the secrets" into
// a green run that reads as "Bedrock is verified". This suite is the only evidence the allowlist is
// anything but an assertion, so in CI a missing region is a failure.
if (process.env.CI && !REGION) {
  throw new Error(
    'Bedrock integration tests cannot run: set the BEDROCK_AWS_REGION, BEDROCK_AWS_ACCESS_KEY_ID ' +
      'and BEDROCK_AWS_SECRET_ACCESS_KEY repository secrets.',
  );
}

const describeWithBedrock = REGION ? describe : describe.skip;

// The geo prefix has to follow the region: an `eu.` profile id is invalid in us-east-1, and pinning
// one would fail the whole suite for a reason unrelated to the code under test.
function geoPrefix(region: string): string {
  if (region.startsWith('us-gov-')) return 'us-gov.';
  if (region.startsWith('eu-')) return 'eu.';
  if (region.startsWith('ap-')) return 'apac.';
  if (region.startsWith('ca-') || region.startsWith('us-')) return 'us.';

  return 'global.';
}

// The models we tell customers we support. Unlike the catalogue sweep below, this list does not
// depend on what the CI account happens to enable: if one of these cannot be verified, the claim is
// unsupported and the suite must say so.
const SUPPORTED_MODELS = REGION
  ? [
      // Claude 5 first: it is the line LangChain's own inference rejects, so it is the one the
      // supportsToolChoiceValues override exists for and the one whose regression would be silent.
      `${geoPrefix(REGION)}anthropic.claude-sonnet-5-v1:0`,
      `${geoPrefix(REGION)}anthropic.claude-sonnet-4-6-v1:0`,
      `${geoPrefix(REGION)}anthropic.claude-haiku-4-5-20251001-v1:0`,
      `${geoPrefix(REGION)}anthropic.claude-opus-4-5-v1:0`,
    ]
  : [];

const DEFAULT_MODEL = process.env.BEDROCK_TEST_MODEL ?? SUPPORTED_MODELS[2];

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

async function forcesAToolCall(model: string): Promise<boolean> {
  const withTools = new AiClient({ aiConfigurations: [bedrockConfig(model)] })
    .getModel()
    .bindTools([calculatorTool()], { tool_choice: 'any' });

  const response = await withTools.invoke([{ role: 'user', content: 'What is 2+2?' }]);

  return Boolean(response.tool_calls?.length);
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

  it('refuses an unknown model at construction, before any network call', () => {
    expect(
      () => new AiClient({ aiConfigurations: [bedrockConfig('anthropic.does-not-exist-v1:0')] }),
    ).toThrow(AIModelNotAllowlistedError);
  });

  // The claim itself, model by model. An AccessDenied here is not an excuse: it means the CI
  // account cannot invoke a model we advertise, so the advertisement is unverified.
  describe('the models we advertise', () => {
    it.each(SUPPORTED_MODELS)(
      '%s honours a forced tool call',
      async model => {
        await expect(forcesAToolCall(model)).resolves.toBe(true);
      },
      120_000,
    );
  });

  // Same contract as llm.integration.test.ts for OpenAI/Anthropic: every model the allowlist in
  // supported-models.ts lets through must actually honour a forced tool call. Bedrock's catalogue
  // is walked in full on purpose, so a Claude release the allowlist admits but Bedrock cannot serve
  // this way is caught here. A failure is the signal to narrow the allowlist, not to loosen the
  // assertion.
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
      const verified: string[] = [];
      const failures: { model: string; error: string }[] = [];
      const unavailable: { model: string; error: string }[] = [];

      for (const model of modelsToTest) {
        try {
          const withTools = new AiClient({ aiConfigurations: [bedrockConfig(model)] })
            .getModel()
            .bindTools([calculatorTool()], { tool_choice: 'any' });

          // eslint-disable-next-line no-await-in-loop
          const response = await withTools.invoke([{ role: 'user', content: 'What is 2+2?' }]);

          if (response.tool_calls?.length) verified.push(model);
          else failures.push({ model, error: 'no tool call in the response' });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const name = (error as { name?: string }).name ?? '';

          // Keyed on the AWS error identity, not on message text: a broken InvokeModel policy makes
          // every model raise "not authorized", which would file the whole catalogue under
          // unavailable and leave failures empty.
          if (name === 'AccessDeniedException' || name === 'ThrottlingException') {
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
      // A suite that verified nothing is broken, not passing: without this the whole catalogue can
      // land in `unavailable` and the allowlist stays an untested assertion that looks tested.
      expect(verified).toContain(DEFAULT_MODEL);
      // eslint-disable-next-line no-console
      console.log(`Verified ${verified.length}/${modelsToTest.length}:`, verified);
    }, 600_000);
  });
});
