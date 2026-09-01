import type { AgentOptionsWithDefaults, BffEmbedOptions, HttpCallback } from './types';
import type { AgentDispatcher, Bff } from '@forestadmin/agent-bff';

import { BFF_PREFIX, stripBffPrefix } from './bff-routes';

/**
 * Serialize the BFF's structured log context onto the message: the agent's logger only accepts an
 * Error as its third argument, so the context would be dropped otherwise. Never throws — logging
 * must not break a request.
 */
function formatLog(message: string, context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return `[bff] ${message}`;

  try {
    return `[bff] ${message} ${JSON.stringify(context)}`;
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
  private embedOptions: BffEmbedOptions | null = null;
  private bff: Bff | null = null;

  constructor(private readonly options: AgentOptionsWithDefaults) {}

  /** Register the embedded BFF. Nothing is built yet: the agent must be mounted first. */
  configure(embedOptions: BffEmbedOptions): void {
    this.embedOptions = embedOptions;
  }

  /**
   * Build the BFF. Called from agent.start() after mount(), because the dispatcher only reaches the
   * agent's own stack once that stack is mounted.
   */
  async start(dispatcher: AgentDispatcher): Promise<void> {
    const { embedOptions } = this;
    if (!embedOptions) return;

    const { buildBff, parseConfig, IN_PROCESS_AGENT_URL } = await this.importPackage();

    const config = parseConfig({
      FOREST_AUTH_SECRET: this.options.authSecret,
      FOREST_ENV_SECRET: this.options.envSecret,
      FOREST_SERVER_URL: this.options.forestServerUrl,
      FOREST_APP_URL: this.options.forestAppUrl,
      // Names where the agent answers, never how it is reached: the dispatcher below is the transport.
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

    this.bff = await buildBff({
      config,
      dispatcher,
      basePath: BFF_PREFIX,
      // Dropped rather than logged: the default sink reports gauges at Info, which would put a
      // schema-cache age line in the host's logs on every read, for a number nobody reads there.
      metrics: { increment: () => undefined, gauge: () => undefined },
      logger: (level, message, context) => this.options.logger(level, formatLog(message, context)),
    });

    this.options.logger('Info', formatLog(`Embedded BFF mounted on ${BFF_PREFIX}`));
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
  }

  /**
   * The callback the agent registers at `/bff`. Answers 503 rather than falling through while the
   * BFF is configured but not built yet: a 404 from the host would read as "wrong url" instead of
   * "not started".
   */
  readonly handle: HttpCallback = (req, res, next) => {
    if (!this.embedOptions) {
      next?.();

      return;
    }

    if (!this.bff) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { type: 'bff_not_started', status: 503 } }));

      return;
    }

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
      throw new Error(
        'The embedded BFF requires the `@forestadmin/agent-bff` package. ' +
          'Install it with `npm install @forestadmin/agent-bff`.',
      );
    }
  }
}
