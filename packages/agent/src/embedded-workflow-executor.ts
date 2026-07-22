import type { AgentOptionsWithDefaults, WorkflowExecutorEmbedOptions } from './types';
import type { WorkflowExecutor } from '@forestadmin/workflow-executor';

import path from 'path';

/** Default loopback port for an embedded workflow executor. */
const DEFAULT_EMBEDDED_EXECUTOR_PORT = 3400;

/**
 * Serialize the executor's structured log context onto the message. The agent's logger only
 * accepts an Error as its third argument, so the executor's rich context (runId, stepId, error,
 * stack…) would be dropped otherwise. Never throws — logging must not crash the executor.
 */
function formatLog(message: string, context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return `[workflow-executor] ${message}`;

  try {
    return `[workflow-executor] ${message} ${JSON.stringify(context)}`;
  } catch {
    return `[workflow-executor] ${message} [unserializable context]`;
  }
}

/**
 * Turn the standalone server's bind host into a host the embedded executor can actually connect
 * to. Wildcard/unspecified binds (undefined, `0.0.0.0`, `::`) are not valid connect targets, so
 * fall back to loopback. IPv6 literals must be bracketed to sit in a URL authority.
 */
function toConnectableHost(host?: string): string {
  if (!host || host === '0.0.0.0' || host === '::') return '127.0.0.1';

  return host.includes(':') ? `[${host}]` : host;
}

/**
 * Owns the lifecycle of a workflow executor embedded in the agent process: configuration,
 * dynamic loading of the optional package, build, and start/stop. The agent only wires the proxy
 * route to the loopback URL `configure()` returns and delegates start/stop.
 */
export default class EmbeddedWorkflowExecutor {
  private config: (WorkflowExecutorEmbedOptions & { port: number }) | null = null;
  private executor: WorkflowExecutor | null = null;

  constructor(private readonly options: AgentOptionsWithDefaults) {}

  /**
   * Register the embedded executor and return the loopback URL the agent must proxy
   * `/_internal/executor/*` to. Throws when the remote `workflowExecutorUrl` option is also set.
   */
  configure(embedOptions: WorkflowExecutorEmbedOptions): string {
    if (this.options.workflowExecutorUrl) {
      throw new Error(
        'Cannot use addWorkflowExecutor together with the workflowExecutorUrl option: the former ' +
          'embeds an executor in-process, the latter targets a remote one. Choose one.',
      );
    }

    if (embedOptions.inMemory && embedOptions.database) {
      throw new Error(
        'addWorkflowExecutor: `inMemory` and `database` are mutually exclusive. The in-memory run ' +
          'store persists nothing; drop one of the two options.',
      );
    }

    const port = embedOptions.port ?? DEFAULT_EMBEDDED_EXECUTOR_PORT;
    this.config = { ...embedOptions, port };

    return `http://127.0.0.1:${port}`;
  }

  /**
   * Build and start the executor. Called from agent.start() after mount(), so the standalone
   * server's host/port (used to derive the agent URL) are already known.
   */
  async start(
    standaloneServerHost: string | undefined,
    standaloneServerPort: number | undefined,
  ): Promise<void> {
    const { config } = this;
    if (!config) return;

    const agentUrl =
      config.agentUrl ?? this.deriveAgentUrl(standaloneServerHost, standaloneServerPort);

    if (!agentUrl) {
      throw new Error(
        'Embedded workflow executor: unable to derive the agent URL. It is only auto-derived when ' +
          'the agent runs on its own server (mountOnStandaloneServer). When mounting on Express, ' +
          'Fastify or NestJS, pass `agentUrl` to addWorkflowExecutor().',
      );
    }

    const { buildDatabaseExecutor, buildInMemoryExecutor } = await this.importPackage();

    const commonOptions = {
      envSecret: this.options.envSecret,
      authSecret: this.options.authSecret,
      forestServerUrl: this.options.forestServerUrl,
      agentUrl,
      httpPort: config.port,
      pollingIntervalS: config.pollingIntervalS,
      stepTimeoutS: config.stepTimeoutS,
      executorEncryptionKey: config.encryptionKey,
      logger: (level, message, context) => this.options.logger(level, formatLog(message, context)),
      // Embedded: the host process owns SIGTERM/SIGINT; the executor must not exit it. agent.stop()
      // drains the executor explicitly.
      manageProcessSignals: false,
    };

    if (config.inMemory) {
      this.options.logger(
        'Warn',
        formatLog(
          'Using an in-memory run store: workflow runs are kept in memory and lost on restart. ' +
            'Pass a `database` to addWorkflowExecutor() to persist them in production.',
        ),
      );
      this.executor = buildInMemoryExecutor(commonOptions);
    } else {
      const { database } = config;

      if (!database) {
        throw new Error(
          'Embedded workflow executor requires a database to persist run state. Pass `database` ' +
            'to addWorkflowExecutor(), or use `inMemory: true`.',
        );
      }

      this.executor = buildDatabaseExecutor({
        ...commonOptions,
        database: database as Parameters<typeof buildDatabaseExecutor>[0]['database'],
      });
    }

    await this.executor.start();
    this.options.logger(
      'Info',
      `Embedded workflow executor started (loopback port ${config.port})`,
    );
  }

  async stop(): Promise<void> {
    await this.executor?.stop();
  }

  /**
   * Derive the URL the embedded executor uses to reach this agent over HTTP. Only possible on a
   * standalone server, where the agent owns the listening host/port.
   */
  private deriveAgentUrl(
    standaloneServerHost: string | undefined,
    standaloneServerPort: number | undefined,
  ): string | null {
    if (!standaloneServerPort) return null;

    // agent-client appends `/forest`, so the URL stops at the configured prefix.
    const prefixPath = path.posix.join('/', this.options.prefix);
    const base = `http://${toConnectableHost(standaloneServerHost)}:${standaloneServerPort}`;

    return prefixPath === '/' ? base : `${base}${prefixPath}`;
  }

  /**
   * Dynamically load the optional @forestadmin/workflow-executor package.
   * Deferred so agents that don't embed an executor never load its code at startup.
   */
  private async importPackage() {
    try {
      return await import('@forestadmin/workflow-executor');
    } catch (error) {
      throw new Error(
        'The embedded workflow executor requires the `@forestadmin/workflow-executor` package. ' +
          'Install it with `npm install @forestadmin/workflow-executor`.',
      );
    }
  }
}
