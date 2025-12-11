import { CompositeId, Logger, LoggerLevel } from '@forestadmin/datasource-toolkit';
import { ForestAdminClient } from '@forestadmin/forestadmin-client';
import { IncomingMessage, ServerResponse } from 'http';

/**
 * Context passed to MCP factory functions.
 * Contains the agent configuration needed to initialize the MCP server.
 */
export interface McpFactoryContext {
  /** Forest Admin server URL */
  forestServerUrl: string;
  /** Environment secret */
  envSecret: string;
  /** Authentication secret */
  authSecret: string;
  /** Logger function */
  logger: Logger;
}

/**
 * Options that can be passed to MCP factory functions.
 */
export interface McpFactoryOptions {
  /**
   * Optional override for the base URL where the agent is publicly accessible.
   * If not provided, it will be automatically fetched from Forest Admin API
   * (the environment's api_endpoint configuration).
   * Example: 'https://my-app.example.com' or 'http://localhost:3000'
   */
  baseUrl?: string;
}

/**
 * Factory function type for creating MCP HTTP callbacks.
 * This is the type that MCP server implementations should export.
 *
 * @example
 * // In @forestadmin/mcp-server
 * export const createMcpServer: McpFactory = async (context, options) => {
 *   const server = new ForestAdminMCPServer(context);
 *   return server.getHttpCallback(options?.baseUrl ? new URL('/', options.baseUrl) : undefined);
 * };
 */
export type McpFactory<TOptions extends McpFactoryOptions = McpFactoryOptions> = (
  context: McpFactoryContext,
  options?: TOptions,
) => Promise<HttpCallback>;

/** Options to configure behavior of an agent's forestadmin driver */
export type AgentOptions = {
  authSecret: string;
  envSecret: string;
  customizeErrorMessage?: ((error: Error) => string | null) | null;
  forestServerUrl?: string;
  logger?: Logger;
  loggerLevel?: LoggerLevel;
  prefix?: string;
  isProduction: boolean;
  schemaPath?: string;
  typingsPath?: string | null;
  typingsMaxDepth?: number;
  instantCacheRefresh?: boolean;
  permissionsCacheDurationInSeconds?: number;
  skipSchemaUpdate?: boolean;
  forestAdminClient?: ForestAdminClient;
  limitExportSize?: number;
  experimental?: {
    webhookCustomActions?: boolean;
    updateRecordCustomActions?: boolean;
  };
  /**
   * @deprecated use `bodyParserOptions.jsonLimit` instead.
   * @todo remove option
   */
  maxBodySize?: string;
  /**
   * Refer to `@koa/bodyparser` options
   * @link https://github.com/koajs/bodyparser?tab=readme-ov-file#options
   */
  bodyParserOptions?: {
    jsonLimit?: number | string;
    enableRawChecking?: boolean;
  };
  /**
   * If true, the agent will not throw an error when a customization error occurs,
   * because of a missing collection for example.
   * @default false
   */
  ignoreMissingSchemaElementErrors?: boolean;
  useUnsafeActionEndpoint?: boolean;
  /**
   * Options for the MCP (Model Context Protocol) server.
   * When enabled, exposes an MCP server endpoint that allows AI assistants
   * to interact with your Forest Admin data.
   */
  mcpServer?: {
    /**
     * Enable the MCP server endpoint.
     * @default false
     */
    enabled?: boolean;
    /**
     * Optional override for the base URL where the agent is publicly accessible.
     * If not provided, it will be automatically fetched from Forest Admin API
     * (the environment's api_endpoint configuration).
     * Example: 'https://my-app.example.com' or 'http://localhost:3000'
     */
    baseUrl?: string;
  };
};
export type AgentOptionsWithDefaults = Readonly<Required<AgentOptions>>;

export type HttpCallback = (req: IncomingMessage, res: ServerResponse, next?: () => void) => void;

export enum HttpCode {
  BadRequest = 400,
  Forbidden = 403,
  InternalServerError = 500,
  NoContent = 204,
  NotFound = 404,
  Ok = 200,
  Unprocessable = 422,
}

export enum RouteType {
  // Changing the values of this enum changes the order in which routes are loaded into koa-router.
  LoggerHandler = 0,
  ErrorHandler = 1,
  PublicRoute = 2,
  Authentication = 3,
  PrivateRoute = 4,
}

export type SelectionIds = {
  areExcluded: boolean;
  ids: CompositeId[];
};
