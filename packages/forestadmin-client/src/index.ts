import type { ForestAdminClient, ForestAdminClientOptions } from './types';

import buildApplicationServices from './build-application-services';
import ForestAdminClientWithCache from './forest-admin-client-with-cache';
import ForestHttpApi from './permissions/forest-http-api';

export { default as JTWTokenExpiredError } from './permissions/errors/jwt-token-expired-error';
export { default as JTWUnableToVerifyError } from './permissions/errors/jwt-unable-to-verify-error';
export { default as ChainedSQLQueryError } from './permissions/errors/chained-sql-query-error';
export { default as EmptySQLQueryError } from './permissions/errors/empty-sql-query-error';
export { default as NonSelectSQLQueryError } from './permissions/errors/non-select-sql-query-error';
export {
  ForestAdminClientOptions,
  Logger,
  LoggerLevel,
  ForestAdminClient,
  ChartHandlerInterface,
  ContextVariablesInstantiatorInterface,
  RawTree,
  RawTreeWithSources,
  ForestAdminServerInterface,
  // MCP-specific types
  ForestSchemaField,
  ForestSchemaAction,
  ForestSchemaCollection,
  ActivityLogResponse,
  ActivityLogAction,
  ActivityLogType,
  CreateActivityLogParams,
  UpdateActivityLogStatusParams,
  // Service interfaces for MCP
  ActivityLogsServiceInterface,
  SchemaServiceInterface,
} from './types';
export { IpWhitelistConfiguration } from './ip-whitelist/types';

// These types are used for the agent-generator package
export {
  CollectionActionEvent,
  EnvironmentPermissionsV4,
  RenderingPermissionV4,
  UserPermissionV4,
} from './permissions/types';
export { UserInfo } from './auth/types';

export default function createForestAdminClient(
  options: ForestAdminClientOptions,
): ForestAdminClient {
  const {
    optionsWithDefaults,
    permission,
    renderingPermission,
    contextVariables,
    chartHandler,
    ipWhitelist,
    schema,
    activityLogs,
    auth,
    modelCustomizationService,
    mcpServerConfigService,
    eventsSubscription,
    eventsHandler,
  } = buildApplicationServices(new ForestHttpApi(), options);

  return new ForestAdminClientWithCache(
    optionsWithDefaults,
    permission,
    renderingPermission,
    contextVariables,
    chartHandler,
    ipWhitelist,
    schema,
    activityLogs,
    auth,
    modelCustomizationService,
    mcpServerConfigService,
    eventsSubscription,
    eventsHandler,
  );
}

export * from './charts/types';
export * from './schema/types';
export * from './model-customizations/types';

export { default as ContextVariablesInjector } from './utils/context-variables-injector';
export { default as ContextVariables } from './utils/context-variables';
export { default as ChartHandler } from './charts/chart-handler';
export { default as ForestAdminClientWithCache } from './forest-admin-client-with-cache';
export { default as buildApplicationServices } from './build-application-services';
export { HttpOptions } from './utils/http-options';
export { default as ForestHttpApi } from './permissions/forest-http-api';
// export is necessary for the agent-generator package
export { default as SchemaService, SchemaServiceOptions } from './schema';
export { default as ActivityLogsService, ActivityLogsOptions } from './activity-logs';

export * from './auth/errors';
