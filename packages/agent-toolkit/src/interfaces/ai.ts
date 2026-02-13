/**
 * Inlined from datasource-toolkit/factory.ts to avoid a dependency on a lower-level package.
 * Must stay structurally compatible with datasource-toolkit's Logger & LoggerLevel.
 * If those types change, update these copies accordingly.
 */
export type LoggerLevel = 'Debug' | 'Info' | 'Warn' | 'Error';
export type Logger = (level: LoggerLevel, message: string, error?: Error) => void;

/** Metadata describing a configured AI provider, used in schema reporting and logging. */
export interface AiProviderMeta {
  name: string;
  provider: string;
  model: string;
}

export interface AiRouter {
  /**
   * Route a request to the AI proxy.
   *
   * Implementations should throw BusinessError subclasses (BadRequestError, NotFoundError,
   * UnprocessableError) for proper HTTP status mapping by the agent's error middleware.
   */
  route(args: {
    route: string;
    body?: unknown;
    query?: Record<string, string | string[] | undefined>;
    mcpServerConfigs?: unknown;
    headers?: Record<string, string | string[] | undefined>;
  }): Promise<unknown>;
}

export interface AiProviderDefinition {
  providers: AiProviderMeta[];
  init(logger: Logger): AiRouter;
}
