import type { McpServerLoadFailure } from './mcp-client';
import type { AiConfiguration } from './provider';
import type RemoteTool from './remote-tool';
import type { ToolProvider } from './tool-provider';
import type { ToolConfig } from './tool-provider-factory';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { ChatBedrockConverse } from '@langchain/aws';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { createBaseChatModel } from './create-base-chat-model';
import { AIBadRequestError, AINotConfiguredError } from './errors';
import getAiConfiguration from './get-ai-configuration';
import { createToolProviders } from './tool-provider-factory';
import validateAiConfigurations from './validate-ai-configurations';

// The chain's STS legs — IRSA/web-identity, a profile with role_arn, SSO — go through a client
// that sets neither request nor connection timeout (@smithy/node-http-handler treats an absent
// one as none), so a blackholed egress hangs this call and the boot with it. IMDS and the ECS
// provider cap themselves at 1s; these do not.
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

  // Proves credentials were found, not that they can call Bedrock: an IAM policy missing
  // bedrock:InvokeModel still surfaces on the first AI step.
  async probeCredentials(): Promise<void> {
    await Promise.all(
      this.aiConfigurations
        .filter(c => c.provider === 'bedrock')
        .map(c => this.probeBedrockCredentials(c)),
    );
  }

  private async probeBedrockCredentials(config: AiConfiguration): Promise<void> {
    // Typed as ChatBedrockConverse rather than reached into structurally: it owns the AWS client
    // whose resolved provider production calls, so re-deriving the chain would test a different
    // object — and typing it means a LangChain release that moves `client` fails the build here
    // instead of turning this probe into a silent no-op.
    const { client } = this.getModel(config.name) as ChatBedrockConverse;

    // A Bedrock API key (AWS_BEARER_TOKEN_BEDROCK) authenticates by bearer token, and LangChain
    // still builds the sigv4 credential provider beside it — one that rejects by design and is
    // never called. Probing it would refuse to boot a deployment that works today.
    if (typeof client.config.token === 'function') {
      this.logger?.(
        'Info',
        `AI configuration "${config.name}": authenticating to Bedrock with a bearer token, ` +
          'credential probe skipped.',
      );

      return;
    }

    let timer: NodeJS.Timeout | undefined;

    try {
      const outcome = await Promise.race([
        client.config.credentials().then(() => 'resolved' as const),
        new Promise<'timeout'>(resolve => {
          timer = setTimeout(() => resolve('timeout'), CREDENTIAL_PROBE_TIMEOUT_MS);
        }),
      ]);

      if (outcome === 'timeout') {
        this.logger?.(
          'Warn',
          `AI configuration "${config.name}": AWS credentials did not resolve within ` +
            `${CREDENTIAL_PROBE_TIMEOUT_MS}ms, starting without verifying them.`,
        );
      }
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      // Only an exhausted chain earns the "where to look" sentence. An MFA prompt, an expired SSO
      // session, a denied AssumeRole and a failing credential_process all arrive here carrying
      // their own diagnosis, and overwriting it sends the operator after file permissions on a
      // profile they never mounted.
      const error = new AIBadRequestError(
        /any providers/i.test(detail)
          ? `AI configuration "${config.name}" uses bedrock, but no AWS credentials could be ` +
            'resolved: the standard chain (IAM role, AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, ' +
            'shared profile) found none. In Docker, a mounted profile must be readable by the ' +
            `image's user. Cause: ${detail}`
          : `AI configuration "${config.name}" uses bedrock and its AWS credentials could not ` +
            `be resolved: ${detail}`,
      );

      // Kept so anything walking the chain (Sentry, causeMessage) reaches the AWS error's own
      // name and metadata instead of stopping at this one. Assigned rather than passed: the
      // BusinessError hierarchy predates the native `cause` option and does not type it.
      throw Object.assign(error, { cause });
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
