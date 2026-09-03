import type { AgentOptionsWithDefaults, BffEmbedOptions, HttpCallback } from './types';
import type { AgentDispatcher, BFFConfig, Bff } from '@forestadmin/agent-bff';

import { BFF_PREFIX, stripBffPrefix } from './bff-routes';

/**
 * Serialize the BFF's structured log context onto the message: the agent's logger only accepts an
 * Error as its third argument, so the context would be dropped otherwise. Errors are unfolded by
 * hand — their `message` and `stack` are not enumerable, so `JSON.stringify` alone turns the one
 * value worth logging into `{}`. Never throws — logging must not break a request.
 */
function formatLog(message: string, context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return `[bff] ${message}`;

  try {
    const serialized = JSON.stringify(context, (_key, value) =>
      value instanceof Error
        ? { name: value.name, message: value.message, stack: value.stack }
        : value,
    );

    return `[bff] ${message} ${serialized}`;
  } catch {
    return `[bff] ${message} [unserializable context]`;
  }
}

/**
 * Owns the lifecycle of a BFF embedded in the agent process: configuration, dynamic loading of the
 * optional package, build, and the request handler the agent mounts at `/bff`. The agent only wires
 * the callback and delegates start/stop.
 */
export default class EmbeddedBff {
  private config: BFFConfig | null = null;
  private bff: Bff | null = null;
  private stopped = false;

  constructor(
    private readonly options: AgentOptionsWithDefaults,
    private readonly embedOptions: BffEmbedOptions,
  ) {}

  /**
   * Load the package and validate the options the caller handed to `addBff()`. Called before the
   * agent mounts anything: everything checked here is caller input, and `parseConfig` throws on a
   * mistyped `tokenEncryptionKey`, timezone, timeout or url. Failing here leaves nothing serving,
   * where failing after mount() would leave the host with a live `/forest` and a bricked `/bff`.
   */
  async prepare(): Promise<void> {
    const { parseConfig, IN_PROCESS_AGENT_URL } = await this.importPackage();
    const { embedOptions } = this;

    this.config = parseConfig({
      FOREST_AUTH_SECRET: this.options.authSecret,
      FOREST_ENV_SECRET: this.options.envSecret,
      FOREST_SERVER_URL: this.options.forestServerUrl,
      FOREST_APP_URL: this.options.forestAppUrl,
      // Names where the agent answers, never how it is reached: the dispatcher is the transport.
      AGENT_URL: IN_PROCESS_AGENT_URL,
      BFF_TOKEN_ENCRYPTION_KEY: embedOptions.tokenEncryptionKey,
      BFF_ALLOWED_ORIGINS: embedOptions.allowedOrigins?.join(','),
      BFF_DEFAULT_TIMEZONE: embedOptions.defaultTimezone,
      BFF_AGENT_TIMEOUT_MS: embedOptions.agentTimeoutMs?.toString(),
      BFF_AI_TIMEOUT_MS: embedOptions.aiTimeoutMs?.toString(),
      // Off unless asked for: the document is not filtered per caller, so mounting a BFF must not
      // publish the name of every exposed collection and field on an already-open port.
      BFF_OPENAPI_ENABLED: String(embedOptions.openapiEnabled ?? false),
    });
  }

  /**
   * Build the BFF. Called from agent.start() after mount(), because the dispatcher only reaches the
   * agent's own stack once that stack is mounted.
   */
  async start(dispatcher: AgentDispatcher): Promise<void> {
    if (!this.config) await this.prepare();

    const { buildBff } = await this.importPackage();

    this.bff = await buildBff({
      config: this.config as BFFConfig,
      dispatcher,
      basePath: BFF_PREFIX,
      // Counters are the schema cache's and the action-endpoint resolver's only channel — they take
      // no logger — and every one of them reports a failure, so they go to the host's logs. Gauges
      // do not: they are periodic cache sizes, and the default console sink reports them at Info,
      // which would flood a host that only asked for a BFF.
      metrics: {
        increment: name => this.options.logger('Warn', formatLog(`metric ${name}`)),
        gauge: () => undefined,
      },
      logger: (level, message, context) => this.options.logger(level, formatLog(message, context)),
    });
    this.stopped = false;

    this.options.logger('Info', formatLog(`Embedded BFF mounted on ${BFF_PREFIX}`));

    await this.warnIfExemptFromIpWhitelist();
  }

  /**
   * The whitelist exempts a caller arriving over a loopback socket with no proxy hop, which is
   * exactly what the in-process transport looks like — so every BFF request escapes it. That is the
   * decision, not an oversight: propagating the caller's ip would make the embedded mode stricter
   * than the standalone one, where the whitelist only ever sees the BFF's own host, and would refuse
   * the browsers a third-party UI is made of. What it must not be is silent — an operator who turned
   * the whitelist on to close a door has no other way to learn this door is not part of it.
   *
   * Reads the configuration itself rather than borrowing the one `IpWhitelist` already fetched: that
   * route keeps it private, and reaching into it would put BFF concerns in an unrelated part of the
   * agent. Costs one round-trip at boot. Never fails the boot: a warning is not worth refusing to
   * serve over, and this is the same posture as the rest of the BFF's startup.
   */
  private async warnIfExemptFromIpWhitelist(): Promise<void> {
    try {
      const { isFeatureEnabled } =
        await this.options.forestAdminClient.getIpWhitelistConfiguration();

      if (!isFeatureEnabled) return;

      this.options.logger(
        'Warn',
        formatLog(
          `The IP whitelist is enabled for this environment, but requests served under ` +
            `${BFF_PREFIX} are not subject to it: they reach the agent in-process, which the ` +
            `whitelist exempts as a trusted loopback caller. A resolved API key or a valid OAuth ` +
            `session is still required.`,
        ),
      );
    } catch (error) {
      this.options.logger(
        'Debug',
        formatLog('Could not read the IP whitelist configuration', {
          cause: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  /** Drop what the BFF read from the SaaS. Called on a restart, which means the schema moved. */
  invalidate(): void {
    this.bff?.invalidate();
  }

  /**
   * Stop answering. The host application keeps whatever middleware it registered, so without this
   * a stopped agent would go on serving BFF data through a dispatcher pointing at a dead stack.
   */
  stop(): void {
    this.bff = null;
    this.stopped = true;
  }

  /**
   * The callback the agent registers at `/bff`. Answers 503 rather than falling through while the
   * BFF is not serving: a 404 from the host would read as "wrong url" instead of "not available".
   * Boot and shutdown are told apart, because a probe should wait on the first and drain on the
   * second.
   */
  readonly handle: HttpCallback = (req, res) => {
    if (!this.bff) {
      const type = this.stopped ? 'bff_stopped' : 'bff_not_started';
      const message = this.stopped
        ? 'The embedded BFF was stopped with the agent.'
        : 'The embedded BFF is not started yet.';

      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { type, status: 503, message } }));

      return;
    }

    // The BFF knows nothing of the prefix it is served under. `originalUrl` is claimed before the
    // rewrite so a host logger reading it still reports the url the client asked for.
    const bffReq = req as typeof req & { originalUrl?: string };
    bffReq.originalUrl ??= bffReq.url;
    req.url = stripBffPrefix(req.url ?? BFF_PREFIX);
    this.bff.callback(req, res);
  };

  /**
   * Dynamically load the optional @forestadmin/agent-bff package. Deferred so agents that embed no
   * BFF never load its code at startup.
   */
  private async importPackage() {
    try {
      return await import('@forestadmin/agent-bff');
    } catch (error) {
      // The original reason is kept: the package resolves from the host's own node_modules, so this
      // also fires on a broken transitive dependency, a SyntaxError from a partial install, or a
      // throw during the package's own evaluation — none of which "install it" would fix.
      const { message } = error as Error;
      const wrapped = new Error(
        `The embedded BFF requires the \`@forestadmin/agent-bff\` package, which failed to ` +
          `load: ${message}. Install it with \`npm install @forestadmin/agent-bff\`.`,
      );
      // Assigned rather than passed to the constructor: the repo targets ES2020, whose lib types no
      // options bag on Error. A plain assignment carries the cause on every runtime, and the reason
      // is in the message regardless of what reads it.
      (wrapped as Error & { cause?: unknown }).cause = error;

      throw wrapped;
    }
  }
}
