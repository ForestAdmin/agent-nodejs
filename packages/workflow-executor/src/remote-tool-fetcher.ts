import type OAuthTokenService from './oauth/token-service';
import type { AiModelPort } from './ports/ai-model-port';
import type { Logger } from './ports/logger-port';
import type { WorkflowPort } from './ports/workflow-port';
import type { McpServerLoadFailure, RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';

import { injectOauthTokens } from '@forestadmin/ai-proxy';

import { OAuthReauthRequiredError } from './errors';

const OAUTH2_AUTH_TYPE = 'oauth2';

function hasAuthFailure(failures: McpServerLoadFailure[]): boolean {
  return failures.some(failure => failure.kind === 'auth');
}

// Match by config.id, not by Record key: server names can collide across configs.
export function scopeConfigsToServer(
  configs: Record<string, ToolConfig>,
  mcpServerId: string,
): Record<string, ToolConfig> {
  return Object.fromEntries(Object.entries(configs).filter(([, cfg]) => cfg.id === mcpServerId));
}

function readAuthType(config: ToolConfig | undefined): string | undefined {
  return (config as { authType?: string } | undefined)?.authType;
}

export interface FetchRemoteToolsResult {
  tools: RemoteTool[];
  mcpServerName?: string;
  // True when the server was found but its tools failed to load, so a caller can tell a genuinely
  // empty server from an unreachable one.
  loadFailed?: boolean;
  // Present only for OAuth2 servers: re-mints the token (forced refresh) and reloads the tools, so
  // the executor can retry once after an upstream 401 on a tool call. Throws OAuthReauthRequiredError
  // when the credential can no longer be refreshed.
  reloadWithFreshAuth?: () => Promise<RemoteTool[]>;
}

export default class RemoteToolFetcher {
  private readonly workflowPort: WorkflowPort;
  private readonly aiModelPort: AiModelPort;
  private readonly logger: Logger;
  private readonly oauthTokenService: OAuthTokenService;

  constructor(
    workflowPort: WorkflowPort,
    aiModelPort: AiModelPort,
    logger: Logger,
    oauthTokenService: OAuthTokenService,
  ) {
    // Fail loudly here instead of a cryptic undefined dereference at the first OAuth fetch —
    // Runner/RunnerConfig are public API, so a JS caller can bypass the compile-time check.
    if (!oauthTokenService) {
      throw new Error('RemoteToolFetcher requires an OAuth token service (mcpOAuthTokenService)');
    }

    this.workflowPort = workflowPort;
    this.aiModelPort = aiModelPort;
    this.logger = logger;
    this.oauthTokenService = oauthTokenService;
  }

  async fetch(mcpServerId: string, userId: number): Promise<FetchRemoteToolsResult> {
    const configs = await this.workflowPort.getMcpServerConfigs();
    const scoped = scopeConfigsToServer(configs, mcpServerId);
    const [mcpServerName] = Object.keys(scoped);

    this.warnMissingTargetServer(configs, scoped, mcpServerId, mcpServerName);

    if (Object.keys(scoped).length === 0) return { tools: [], mcpServerName };

    if (readAuthType(scoped[mcpServerName]) === OAUTH2_AUTH_TYPE) {
      return this.fetchOAuthTools(scoped, mcpServerName, mcpServerId, userId);
    }

    const { tools, failures } = await this.aiModelPort.loadRemoteToolsWithFailures(scoped);
    const loadFailed = this.errorOnPartialLoadFailure(failures, mcpServerId, mcpServerName);

    return { tools, mcpServerName, loadFailed };
  }

  // OAuth2 path: acquire a per-user access token, inject it as a Bearer header, then list tools.
  // Tool listing is the first authenticated call, so an auth failure here forces one token refresh
  // and a single retry; a still-failing load is a genuine re-auth case.
  private async fetchOAuthTools(
    scoped: Record<string, ToolConfig>,
    mcpServerName: string,
    mcpServerId: string,
    userId: number,
  ): Promise<FetchRemoteToolsResult> {
    const tokenService = this.oauthTokenService;

    const attemptLoad = async (
      forceRefresh: boolean,
    ): Promise<{ tools: RemoteTool[]; failures: McpServerLoadFailure[] }> => {
      const token = await tokenService.getAccessToken(userId, mcpServerId, { forceRefresh });
      const bearer = `Bearer ${token}`;
      // All scoped configs share this mcpServerId, so inject the token for every one — not just the
      // first key — or extra same-id servers load unauthenticated and report spurious auth failures.
      const injected =
        injectOauthTokens({
          configs: scoped,
          tokensByMcpServerName: Object.fromEntries(
            Object.keys(scoped).map(name => [name, bearer]),
          ),
        }) ?? scoped;

      return this.aiModelPort.loadRemoteToolsWithFailures(injected);
    };

    const reloadWithFreshAuth = async (): Promise<RemoteTool[]> => {
      const attempt = await attemptLoad(true);
      if (hasAuthFailure(attempt.failures)) throw new OAuthReauthRequiredError(mcpServerId);
      this.errorOnPartialLoadFailure(attempt.failures, mcpServerId, mcpServerName);

      return attempt.tools;
    };

    const initial = await attemptLoad(false);

    if (hasAuthFailure(initial.failures)) {
      return { tools: await reloadWithFreshAuth(), mcpServerName, reloadWithFreshAuth };
    }

    const loadFailed = this.errorOnPartialLoadFailure(initial.failures, mcpServerId, mcpServerName);

    return { tools: initial.tools, mcpServerName, reloadWithFreshAuth, loadFailed };
  }

  // Distinguish "no configs at all" (deployment misconfig) from "configs exist but none match"
  // (orchestrator/executor drift on server id) — both yield zero tools, but ops need to know
  // which one to fix.
  private warnMissingTargetServer(
    configs: Record<string, ToolConfig>,
    scoped: Record<string, ToolConfig>,
    mcpServerId: string,
    mcpServerName: string | undefined,
  ): void {
    if (Object.keys(scoped).length > 0) return;

    const availableMcpServerIds = Object.values(configs)
      .map(cfg => cfg.id)
      .filter((id): id is string => Boolean(id));

    this.logger(
      'Warn',
      Object.keys(configs).length === 0
        ? 'MCP step targets a server but orchestrator returned no MCP configs'
        : 'MCP step targets a server not advertised by the orchestrator',
      { requestedMcpServerId: mcpServerId, mcpServerName, availableMcpServerIds },
    );
  }

  // Report what the providers said failed, with why. Inferring it from absent tools instead would
  // flag a healthy server that exposes none, and could never name a cause.
  private errorOnPartialLoadFailure(
    failures: McpServerLoadFailure[],
    mcpServerId: string,
    mcpServerName: string | undefined,
  ): boolean {
    if (failures.length === 0) return false;

    this.logger('Error', 'MCP servers failed to load tools', {
      requestedMcpServerId: mcpServerId,
      mcpServerName,
      failures: failures.map(failure => ({
        server: failure.server,
        kind: failure.kind,
        error: failure.error.message,
      })),
    });

    return true;
  }
}
