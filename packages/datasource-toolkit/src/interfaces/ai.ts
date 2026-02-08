import type { Logger } from '../factory';

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
