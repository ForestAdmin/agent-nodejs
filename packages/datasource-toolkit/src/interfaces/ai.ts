import type { Logger } from '../factory';

export interface AiRouter {
  /**
   * Route a request to the AI proxy.
   *
   * Implementations should throw errors with a numeric `status` property (e.g. 400, 404, 422)
   * for HTTP-status-based error translation. Errors without a `status` property
   * are treated as unexpected internal errors and re-thrown as-is.
   */
  route(args: {
    route: string;
    body?: unknown;
    query?: Record<string, string | string[] | undefined>;
    mcpServerConfigs?: unknown;
    requestHeaders?: Record<string, string | string[] | undefined>;
  }): Promise<unknown>;
}

export interface AiProviderDefinition {
  providers: Array<{ name: string; provider: string }>;
  init(logger: Logger): AiRouter;
}
