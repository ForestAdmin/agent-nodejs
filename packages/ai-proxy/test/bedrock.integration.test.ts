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

// The three lines we advertise. Versions are deliberately not pinned: which Claude releases a
// region carries is AWS's call and changes without us, so a pinned id fails the suite for a reason
// that has nothing to do with the code. What must hold is that every line we advertise has at least
// one model this account can actually drive.
const ADVERTISED_LINES = ['claude-sonnet', 'claude-haiku', 'claude-opus'];

function advertisedLineOf(model: string): string | undefined {
  return ADVERTISED_LINES.find(line => model.includes(line));
}

// maxRetries mirrors AiClientAdapter, which production goes through: createBaseChatModel defaults
// to 0, so a test building AiClient directly would treat a single throttle as terminal where the
// executor would have retried.
function bedrockConfig(model: string): AiConfiguration {
  return { name: 'test', provider: 'bedrock', model, region: REGION, maxRetries: 2 };
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
  // Discovered once and shared: what a region carries is AWS's call, so every assertion below is
  // written against what this account can actually reach rather than against a pinned id.
  let modelsToTest: string[];

  // The list is sorted, so modelsToTest[0] is the oldest release — the one most likely to be
  // retired or left unentitled, which would fail the smoke tests for a reason that is not Bedrock
  // refusing our request shape. Walk until one answers instead.
  async function firstDrivable(): Promise<string> {
    const pinned = process.env.BEDROCK_TEST_MODEL;

    if (pinned) return pinned;

    const failures: string[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const model of modelsToTest) {
      // eslint-disable-next-line no-await-in-loop
      const reason = await forcesAToolCall(model).then(
        driven => (driven ? null : 'no tool call'),
        (error: Error) => `${error.name}`,
      );

      if (reason === null) return model;

      failures.push(`${model} (${reason})`);
    }

    throw new Error(`No model could be driven.\n  ${failures.join('\n  ')}`);
  }

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

  it('completes a simple chat request', async () => {
    const model = new AiClient({
      aiConfigurations: [bedrockConfig(await firstDrivable())],
    }).getModel();

    const response = await model.invoke([
      { role: 'system', content: 'You are a helpful assistant. Be very concise.' },
      { role: 'user', content: 'What is 2+2? Reply with just the number.' },
    ]);

    expect(String(response.content)).toContain('4');
  }, 60_000);

  // The exact call the workflow executor makes on every AI step (base-step-executor.ts).
  it('forces a tool call with tool_choice: any', async () => {
    const model = new AiClient({
      aiConfigurations: [bedrockConfig(await firstDrivable())],
    }).getModel();
    const withTools = model.bindTools([calculatorTool()], { tool_choice: 'any' });

    const response = await withTools.invoke([{ role: 'user', content: 'What is 2+2?' }]);

    expect(response.tool_calls?.[0]?.name).toBe('calculate');
  }, 60_000);

  it('refuses an unknown model at construction, before any network call', () => {
    expect(
      () => new AiClient({ aiConfigurations: [bedrockConfig('anthropic.does-not-exist-v1:0')] }),
    ).toThrow(AIModelNotAllowlistedError);
  });

  // The claim itself, one line at a time. An AccessDenied here is not an excuse: it means the CI
  // account cannot drive a line we advertise, so the advertisement is unverified.
  describe('the lines we advertise', () => {
    it.each(ADVERTISED_LINES)(
      '%s has a model this account can drive',
      async line => {
        const candidates = modelsToTest.filter(model => advertisedLineOf(model) === line);

        expect(candidates.length).toBeGreaterThan(0);

        // "at least one" is the claim, so try until one answers rather than betting on the first.
        const failures: string[] = [];

        // eslint-disable-next-line no-restricted-syntax
        for (const model of candidates) {
          // eslint-disable-next-line no-await-in-loop
          const outcome = await forcesAToolCall(model).then(
            driven => (driven ? null : 'no tool call in the response'),
            (error: Error) => `${error.name}: ${error.message}`,
          );

          if (outcome === null) return;

          failures.push(`${model} (${outcome})`);
        }

        throw new Error(`No ${line} model could be driven.\n  ${failures.join('\n  ')}`);
      },
      300_000,
    );
  });

  // Same contract as llm.integration.test.ts for OpenAI/Anthropic: every model the allowlist in
  // supported-models.ts lets through must actually honour a forced tool call. Bedrock's catalogue
  // is walked in full on purpose, so a Claude release the allowlist admits but Bedrock cannot serve
  // this way is caught here. A failure is the signal to narrow the allowlist, not to loosen the
  // assertion.
  describe('Model tool support verification', () => {
    it('every model this account can invoke honours a forced tool call', async () => {
      const verified: string[] = [];
      const failures: { model: string; error: string }[] = [];
      const unavailable: { model: string; error: string }[] = [];
      const throttled: { model: string; error: string }[] = [];

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
          // Throttling is kept apart from entitlement: one says this account may not use the model,
          // the other says we asked too fast. Sharing a bucket lets a throttled run report the same
          // green as a fully verified one.
          // A Legacy model AWS parks because *this account* has not called it in 30 days is an
          // account state like entitlement, not a verdict on the model — it answers fine on an
          // account that uses it. Read from the message because the exception name it shares with
          // a genuine end-of-life is the same, and end-of-life must stay a failure: that one is
          // how a retired id earns its place in the denylist.
          const parkedAsLegacy = /Legacy/i.test(message) && /last 30 days/i.test(message);

          if (name === 'AccessDeniedException' || parkedAsLegacy) {
            unavailable.push({ model, error: message });
          } else if (name === 'ThrottlingException') {
            throttled.push({ model, error: message });
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

      // eslint-disable-next-line no-console
      console.log(`Verified ${verified.length}/${modelsToTest.length}:`, verified);

      expect(failures).toEqual([]);
      // A suite that verified nothing is broken, not passing: without this the whole catalogue can
      // land in `unavailable` and the allowlist stays an untested assertion that looks tested.
      expect(verified.length).toBeGreaterThan(0);
      // Throttling is our own doing — a serial walk with no backoff — so it is a broken run, not a
      // verdict on a model. Failing here is what stops a mostly-throttled sweep reading as proof.
      expect(throttled).toEqual([]);
    }, 600_000);
  });
});
