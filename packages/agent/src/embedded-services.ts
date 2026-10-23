import type { GatewayServices } from './gateway';
import type InProcessDispatcher from './mcp-in-process-dispatcher';
import type {
  AgentOptionsWithDefaults,
  BffEmbedOptions,
  GatewayOptions,
  HttpCallback,
  McpEmbedOptions,
  RootHandler,
} from './types';
import type { FileUploadsOptions, TokenTtlOptions, ToolName } from '@forestadmin/mcp-server';

import { normalizeDomainList } from '@forestadmin/forestadmin-client';

import { BFF_PREFIX, collidesWithBff, createBffAliasCallback } from './bff-routes';
import EmbeddedBff from './embedded-bff';
import {
  AGENT_BFF_PEER_VERSION,
  assertNoGatewayOverlap,
  describeGatewayRoutes,
  mcpUnavailable,
  resolveGatewayServices,
  servesOAuth,
} from './gateway';

const normalizeMcpBasePath = (basePath?: string): string =>
  `/${(basePath ?? '').trim()}`.replace(/\/+/g, '/').replace(/\/$/, '');

// Whichever is registered second raises it. `addBff()` registers at builder time and the MCP
// server only at start(), and the root middleware answers with the first handler whose matcher
// claims the url — so the BFF wins and the whole MCP surface would go silently dark.
const bffMcpCollision = (mcpBasePath: string) =>
  `Cannot use addBff together with mountAiMcpServer({ basePath: '${mcpBasePath}' }): the MCP ` +
  `server would claim ${BFF_PREFIX} paths the embedded BFF answers on (${BFF_PREFIX}/oauth, ` +
  `${BFF_PREFIX}/mcp). Mount the MCP server elsewhere.`;

const GATEWAY_DOC = 'https://docs.forest.app/product/embed/gateway';

const MCP_ALIAS_MIXING =
  'mountAiMcpServer() is a deprecated alias of addGateway({ mcp }) and cannot be combined ' +
  'with addGateway(): configure every service through a single addGateway({ mcp, api }) ' +
  `call. See ${GATEWAY_DOC}#the-deprecated-mcp-alias`;

const API_ALIAS_MIXING =
  'addBff() is a deprecated alias of addGateway({ api }) and cannot be combined with ' +
  'addGateway(): configure every service through a single addGateway({ mcp, api }) call. ' +
  `See ${GATEWAY_DOC}#moving-from-addbff-to-addgateway--api-`;

export type EmbeddedServicesHost = {
  setMcpCallback: (handler: RootHandler | null) => void;
  setGatewayCallback: (handler: RootHandler) => void;
  setBffCallback: (callback: HttpCallback | null) => void;
  getInProcessDispatcher: () => InProcessDispatcher;
  completeMountPrefix: () => string;
  isStopped: () => boolean;
  startupBegun: () => boolean;
};

export default class EmbeddedServices {
  /** Whether MCP server should be mounted */
  private mcpEnabled = false;
  private mcpEnabledTools?: ToolName[];
  private mcpBasePath?: string;
  private mcpTokenTtl?: TokenTtlOptions;
  private mcpAllowedOAuthClients?: string[];
  private mcpFileUploads?: false | FileUploadsOptions;

  /** In-process BFF, created only when addBff() is called. */
  private embeddedBff: EmbeddedBff | null = null;

  private gateway: {
    basePath: string;
    services: GatewayServices;
    allowedOAuthClients?: string[];
    build?: (mcp?: RootHandler) => RootHandler;
    mcpStopped?: RootHandler;
  } | null = null;

  constructor(
    private readonly options: AgentOptionsWithDefaults,
    private readonly host: EmbeddedServicesHost,
  ) {}

  get isMcpEnabled(): boolean {
    return this.mcpEnabled;
  }

  get hasGateway(): boolean {
    return Boolean(this.gateway);
  }

  get hasGatewayBuild(): boolean {
    return Boolean(this.gateway?.build);
  }

  get bff(): EmbeddedBff | null {
    return this.embeddedBff;
  }

  addGateway(options: GatewayOptions): void {
    if (this.gateway) throw new Error('addGateway can only be called once.');

    if (this.host.startupBegun()) {
      throw new Error('addGateway must be called before start(): the agent is already starting.');
    }

    if (this.mcpEnabled) this.rejectGatewayMixing(MCP_ALIAS_MIXING);
    if (this.embeddedBff) this.rejectGatewayMixing(API_ALIAS_MIXING);

    const services = resolveGatewayServices(options);
    this.gateway = {
      basePath: options.basePath ?? '',
      services,
      allowedOAuthClients: options.allowedOAuthClients,
    };

    if (services.mcp) {
      this.mcpEnabled = true;
      this.mcpEnabledTools = services.mcp.enabledTools;
      this.mcpTokenTtl = services.mcp.tokenTtl;
      this.mcpAllowedOAuthClients = options.allowedOAuthClients;
      this.mcpFileUploads = services.mcp.fileUploads;
    }

    if (services.api) this.host.getInProcessDispatcher();
  }

  mountAiMcpServer(options?: McpEmbedOptions): void {
    if (this.gateway) this.rejectGatewayMixing(MCP_ALIAS_MIXING);

    if (this.embeddedBff && collidesWithBff(options?.basePath)) {
      throw new Error(bffMcpCollision(options?.basePath as string));
    }

    this.mcpEnabled = true;
    this.mcpEnabledTools = options?.enabledTools;
    this.mcpBasePath = options?.basePath;
    this.mcpTokenTtl = options?.tokenTtl;
    this.mcpAllowedOAuthClients = options?.allowedOAuthClients;
    this.mcpFileUploads = options?.fileUploads;
  }

  addBff(options: BffEmbedOptions): void {
    if (this.gateway) this.rejectGatewayMixing(API_ALIAS_MIXING);

    if (this.embeddedBff) {
      throw new Error('addBff can only be called once.');
    }

    // Refused rather than accepted and left dark: once startup has begun the dispatcher hook has no
    // mount left to attach to and nothing calls the BFF's own start(), so `/bff` would answer 503
    // for the rest of the process while every other route works. A throw on the line the developer
    // wrote instead. Refused from the first line of start(), not from its last: `start()` is async,
    // so a call made while it is still in flight is just as late.
    if (this.host.startupBegun()) {
      throw new Error('addBff must be called before start(): the agent is already starting.');
    }

    if (collidesWithBff(this.mcpBasePath)) {
      throw new Error(bffMcpCollision(this.mcpBasePath as string));
    }

    const bff = new EmbeddedBff(this.options, options, { prefix: BFF_PREFIX });
    this.embeddedBff = bff;
    // Registered now rather than at start(): getInProcessDispatcher() pushes its hook the first
    // time it is called, and mount() only runs the hooks registered before it — asked for later,
    // the dispatcher would have no handler until the first restart.
    this.host.getInProcessDispatcher();
    this.host.setBffCallback(createBffAliasCallback(bff.handle, this.options.logger));
  }

  async prepareGateway(): Promise<void> {
    if (!this.gateway) return;

    const { services } = this.gateway;

    if (!services.mcp && !services.api) {
      throw new Error(
        'addGateway() enables no service: pass mcp, api, or both, e.g. addGateway({ mcp: true }).',
      );
    }

    normalizeDomainList(this.gateway.allowedOAuthClients);

    const { createGatewaySwitch, makeIsMcpRoute, normalizeMountPath } = await import(
      '@forestadmin/mcp-server'
    );
    const basePath = normalizeMountPath(this.gateway.basePath, 'basePath');

    assertNoGatewayOverlap(basePath, this.host.completeMountPrefix(), services);
    this.gateway.basePath = basePath;
    if (services.mcp) this.mcpBasePath = basePath || undefined;

    const bff = services.api ? this.gatewayApi(basePath, services.api) : null;
    const api = bff ? { matches: (path: string) => bff.claims(path), callback: bff.handle } : null;
    const isMcpRoute = makeIsMcpRoute(basePath);
    const mcpStarting = services.mcp ? mcpUnavailable(isMcpRoute, 'starting') : null;

    if (services.mcp) this.gateway.mcpStopped = mcpUnavailable(isMcpRoute, 'stopped');

    this.gateway.build = mcp =>
      createGatewaySwitch({
        basePath,
        mcp: mcp ?? mcpStarting ?? undefined,
        api: api ?? undefined,
      });
  }

  private gatewayApi(basePath: string, options: BffEmbedOptions): EmbeddedBff {
    this.embeddedBff ??= new EmbeddedBff(this.options, options, {
      prefix: `${basePath}/api`,
      name: 'The Gateway API',
      requiredVersion: AGENT_BFF_PEER_VERSION,
      skipIpWhitelistWarning: Boolean(this.gateway?.services.mcp),
      allowedOAuthClients: this.gateway?.allowedOAuthClients,
      gateway: true,
    });

    return this.embeddedBff;
  }

  private rejectGatewayMixing(message: string): never {
    this.options.logger('Error', message);

    throw new Error(message);
  }

  warnIfMcpAliasUsed(): void {
    if (!this.mcpEnabled || this.gateway) return;

    this.options.logger(
      'Warn',
      '[MCP] mountAiMcpServer() is deprecated: use addGateway({ mcp }) instead. ' +
        'It keeps serving on its current paths.',
    );
  }

  setRootHandlers(mcp?: RootHandler): void {
    if (!this.gateway?.build) {
      this.host.setMcpCallback(mcp ?? null);

      return;
    }

    const stopped = this.host.isStopped() ? this.gateway.mcpStopped : undefined;

    this.host.setGatewayCallback(this.gateway.build(stopped ?? mcp));
  }

  logGatewayRoutes(): void {
    if (!this.gateway) return;

    const { basePath, services, allowedOAuthClients } = this.gateway;

    describeGatewayRoutes(basePath, services).forEach(line => this.options.logger('Info', line));

    if (allowedOAuthClients && !servesOAuth(services)) {
      this.options.logger(
        'Warn',
        '[Gateway] allowedOAuthClients is set but no OAuth route is served (MCP off, API OAuth off).',
      );
    }
  }

  async warnIfMcpExemptFromIpWhitelist(): Promise<void> {
    try {
      const { isFeatureEnabled } =
        await this.options.forestAdminClient.getIpWhitelistConfiguration();

      if (!isFeatureEnabled) return;

      const base = normalizeMcpBasePath(this.mcpBasePath);
      const apiNote = this.gateway?.services.api
        ? ` The Gateway API on ${base}/api/* escapes it too: it reaches the agent in-process, ` +
          'which the whitelist exempts as a trusted loopback caller. API calls still require an ' +
          'API key or an OAuth session.'
        : '';

      this.options.logger(
        'Warn',
        '[MCP] The IP whitelist is enabled for this environment, but it filters none of the MCP ' +
          `routes (${base}/mcp, ${base}/mcp/uploads, ${base}/oauth/*, ` +
          `/.well-known/oauth-authorization-server${base}, ` +
          `/.well-known/oauth-protected-resource${base}/mcp): its middleware is mounted on the ` +
          `/forest router only, so these routes escape it for any caller. Tool calls on ${base}/mcp ` +
          `still require a valid MCP OAuth token.${apiNote}`,
      );
    } catch (error) {
      this.options.logger(
        'Debug',
        `[MCP] Could not read the IP whitelist configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Initialize the MCP server.
   * Uses dynamic import to defer loading until mountAiMcpServer() is actually used.
   * This avoids loading the mcp-server dependency at startup for users who don't use MCP.
   */
  async initializeMcpServer(): Promise<RootHandler> {
    const mcpLogger = (level, message) => this.options.logger(level, `[MCP] ${message}`);

    try {
      // Dynamic import to defer loading until actually needed
      const { ForestMCPServer, ForestServerClientImpl, makeIsMcpRoute } = await import(
        '@forestadmin/mcp-server'
      );

      const forestServerClient = new ForestServerClientImpl(
        this.options.forestAdminClient.schemaService,
        this.options.forestAdminClient.activityLogsService,
        this.options.forestAdminClient.workflowsService,
        this.options.forestServerUrl,
      );

      const mcpServer = new ForestMCPServer({
        forestServerUrl: this.options.forestServerUrl,
        forestAppUrl: this.options.forestAppUrl,
        envSecret: this.options.envSecret,
        authSecret: this.options.authSecret,
        logger: mcpLogger,
        forestServerClient,
        enabledTools: this.mcpEnabledTools,
        basePath: this.mcpBasePath,
        tokenTtl: this.mcpTokenTtl,
        allowedOAuthClients: this.mcpAllowedOAuthClients,
        fileUploads: this.mcpFileUploads,
        agentDispatcher: this.host.getInProcessDispatcher(),
      });

      const callback = await mcpServer.getHttpCallback();
      const matches = makeIsMcpRoute(this.mcpBasePath);

      mcpLogger('Info', 'Server initialized successfully');
      mcpLogger(
        'Info',
        'Tool calls dispatch in-process and skip any middleware mounted in front of the agent',
      );

      return { callback, matches };
    } catch (error) {
      const { message } = error as Error;
      mcpLogger('Error', `Failed to initialize MCP server: ${message}`);
      throw error;
    }
  }
}
