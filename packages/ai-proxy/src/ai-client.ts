import type { McpServerLoadFailure } from './mcp-client';
import type { AiConfiguration } from './provider';
import type RemoteTool from './remote-tool';
import type { ToolProvider } from './tool-provider';
import type { ToolConfig } from './tool-provider-factory';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { createBaseChatModel } from './create-base-chat-model';
import { AIBadRequestError, AINotConfiguredError } from './errors';
import getAiConfiguration from './get-ai-configuration';
import { createToolProviders } from './tool-provider-factory';
import validateAiConfigurations from './validate-ai-configurations';

// Bounds the boot probe: the chain ends in a metadata call on EC2/ECS, which can lag.
const CREDENTIAL_PROBE_TIMEOUT_MS = 10_000;

// eslint-disable-next-line import/prefer-default-export
export class AiClient {
  private readonly aiConfigurations: AiConfiguration[];
  private readonly logger?: Logger;
  private readonly modelCache = new Map<string, BaseChatModel>();
  private toolProviders: ToolProvider[] = [];

  constructor(params?: { aiConfigurations?: AiConfiguration[]; logger?: Logger }) {
    this.aiConfigurations = params?.aiConfigurations ?? [];
    this.logger = params?.logger;

    validateAiConfigurations(this.aiConfigurations);
  }

  getModel(aiName?: string): BaseChatModel {
    const config = getAiConfiguration(this.aiConfigurations, aiName, this.logger);
    if (!config) throw new AINotConfiguredError();

    const cached = this.modelCache.get(config.name);
    if (cached) return cached;

    const model = createBaseChatModel(config);
    this.modelCache.set(config.name, model);

    return model;
  }

  // Resolves the AWS credential chain once, at startup, for every bedrock configuration.
  // Without it a container whose credentials never resolve — an AWS profile mounted where the
  // image's user cannot read it is the common one — starts, answers its health check, and only
  // fails on the first AI step of the first workflow. Same reasoning as the region check in the
  // CLI, applied to the other half of the configuration.
  // What it proves is narrow and worth stating: credentials were found, not that they may call
  // Bedrock. An IAM policy missing bedrock:InvokeModel still surfaces on first use.
  async probeCredentials(): Promise<void> {
    const bedrockConfigs = this.aiConfigurations.filter(c => c.provider === 'bedrock');

    await Promise.all(bedrockConfigs.map(config => this.probeBedrockCredentials(config)));
  }

  private async probeBedrockCredentials(config: AiConfiguration): Promise<void> {
    // Reaching into the LangChain client: ChatBedrockConverse builds the AWS SDK client and its
    // resolved credential provider, and re-deriving the chain here would test a different object
    // than the one production calls.
    const { client } = this.getModel(config.name) as unknown as {
      client?: { config?: { credentials?: () => Promise<unknown> } };
    };
    const resolve = client?.config?.credentials;

    if (typeof resolve !== 'function') return;

    const timedOut = Symbol('timed-out');
    let timer: NodeJS.Timeout | undefined;

    try {
      const outcome = await Promise.race([
        resolve(),
        new Promise(resolve_ => {
          timer = setTimeout(() => resolve_(timedOut), CREDENTIAL_PROBE_TIMEOUT_MS);
        }),
      ]);

      // A slow chain is not a wrong one — on EC2 and ECS it ends in a local metadata call that can
      // lag. Failing the boot on that would trade a rare misconfiguration for a flaky deploy, so
      // the probe gives up its verdict rather than the startup.
      if (outcome === timedOut) {
        this.logger?.(
          'Warn',
          `AI configuration "${config.name}": AWS credentials did not resolve within ` +
            `${CREDENTIAL_PROBE_TIMEOUT_MS}ms, starting without verifying them.`,
        );
      }
    } catch (cause) {
      throw new AIBadRequestError(
        `AI configuration "${config.name}" uses bedrock, but no AWS credentials could be ` +
          'resolved: the standard chain (IAM role, AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, ' +
          'shared profile) found none. In Docker, a mounted profile must be readable by the ' +
          `image's user. Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async loadRemoteTools(configs: Record<string, ToolConfig>): Promise<RemoteTool[]> {
    return (await this.loadRemoteToolsWithFailures(configs)).tools;
  }

  // Same load as loadRemoteTools, but also returns the classified per-server failures providers
  // surface (only MCP providers do today). The default loadRemoteTools drops them, so existing
  // consumers are unaffected.
  async loadRemoteToolsWithFailures(
    configs: Record<string, ToolConfig>,
  ): Promise<{ tools: RemoteTool[]; failures: McpServerLoadFailure[] }> {
    await this.disposeToolProviders('Error closing previous remote tool connection');

    const providers = createToolProviders(configs, this.logger);
    const resultsByProvider = await Promise.all(
      providers.map(async provider =>
        provider.loadToolsWithFailures
          ? provider.loadToolsWithFailures()
          : { tools: await provider.loadTools(), failures: [] },
      ),
    );
    this.toolProviders = providers;

    return {
      tools: resultsByProvider.flatMap(result => result.tools),
      failures: resultsByProvider.flatMap(result => result.failures),
    };
  }

  async closeConnections(): Promise<void> {
    await this.disposeToolProviders('Error during remote tool connection cleanup');
  }

  private async disposeToolProviders(errorMessage: string): Promise<void> {
    if (this.toolProviders.length === 0) return;

    const providers = this.toolProviders;
    this.toolProviders = [];

    const results = await Promise.allSettled(providers.map(p => p.dispose()));

    results.forEach(result => {
      if (result.status === 'rejected') {
        const { reason } = result;
        const err = reason instanceof Error ? reason : new Error(String(reason));
        this.logger?.('Error', errorMessage, err);
      }
    });
  }
}
