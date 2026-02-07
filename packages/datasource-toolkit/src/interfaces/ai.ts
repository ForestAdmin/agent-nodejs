import type { Logger } from '../factory';

export interface AiRouter {
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
