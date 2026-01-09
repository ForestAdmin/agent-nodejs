import type { Tokens, UserInfo } from './auth/types';
import type { ChartRequest } from './charts/chart-handler';
import type { Chart, QueryChart } from './charts/types';
import type { IpWhitelistConfiguration } from './ip-whitelist/types';
import type { McpServerConfigService } from './mcp-server-config/types';
import type { ModelCustomization, ModelCustomizationService } from './model-customizations/types';
import type { HttpOptions } from './permissions/forest-http-api';
import type {
  CollectionActionEvent,
  EnvironmentPermissionsV4,
  RawTree,
  RawTreeWithSources,
  RenderingPermissionV4,
  UserPermissionV4,
} from './permissions/types';
import type { ForestSchema } from './schema/types';
import type { RequestContextVariables } from './utils/context-variables';
import type ContextVariables from './utils/context-variables';
import type { McpConfiguration } from '@forestadmin/ai-proxy';
import type { ParsedUrlQuery } from 'querystring';

export type { CollectionActionEvent, RawTree, RawTreeWithSources } from './permissions/types';

export type LoggerLevel = 'Debug' | 'Info' | 'Warn' | 'Error';
export type Logger = (level: LoggerLevel, message: unknown) => void;

export type ForestAdminClientOptions = {
  envSecret: string;
  forestServerUrl?: string;
  logger?: Logger;
  permissionsCacheDurationInSeconds?: number;
  instantCacheRefresh?: boolean;
  experimental?: unknown;
};

export type ForestAdminClientOptionsWithDefaults = Required<
  Omit<ForestAdminClientOptions, 'experimental'>
> &
  Pick<ForestAdminClientOptions, 'experimental'>;

export type ForestAdminAuthServiceInterface = {
  init: () => Promise<void>;
  getUserInfo: (renderingId: number, accessToken: string) => Promise<UserInfo>;
  generateAuthorizationUrl: (params: { scope: string; state: string }) => Promise<string>;
  generateTokens: (params: { query: ParsedUrlQuery; state: string }) => Promise<Tokens>;
};

export interface ForestAdminClient {
  readonly permissionService: PermissionService;
  readonly contextVariablesInstantiator: ContextVariablesInstantiatorInterface;
  readonly chartHandler: ChartHandlerInterface;
  readonly modelCustomizationService: ModelCustomizationService;
  readonly mcpServerConfigService: McpServerConfigService;
  readonly authService: ForestAdminAuthServiceInterface;
  readonly schemaService: SchemaServiceInterface;
  readonly activityLogsService: ActivityLogsServiceInterface;

  verifySignedActionParameters<TSignedParameters>(signedParameters: string): TSignedParameters;

  getIpWhitelistConfiguration(): Promise<IpWhitelistConfiguration>;

  postSchema(schema: ForestSchema): Promise<boolean>;

  getScope(params: {
    renderingId: number | string;
    userId: number | string;
    collectionName: string;
  }): Promise<RawTree>;
  markScopesAsUpdated(renderingId: number | string): void;

  subscribeToServerEvents(): Promise<void>;
  close(): void;
  onRefreshCustomizations(handler: () => void | Promise<void>): void;
}

export interface PermissionService {
  canOnCollection(params: {
    userId: number | string;
    event: CollectionActionEvent;
    collectionName: string;
  }): Promise<boolean>;
  canTriggerCustomAction(params: {
    userId: number | string;
    customActionName: string;
    collectionName: string;
  }): Promise<boolean>;
  doesTriggerCustomActionRequiresApproval(params: {
    userId: number | string;
    customActionName: string;
    collectionName: string;
  }): Promise<boolean>;
  canApproveCustomAction(params: {
    userId: number | string;
    customActionName: string;
    collectionName: string;
    requesterId: number | string;
  }): Promise<boolean>;
  canRequestCustomActionParameters(params: {
    userId: number | string;
    collectionName: string;
    customActionName: string;
  }): Promise<boolean>;
  canExecuteChart(params: {
    renderingId: number | string;
    userId: number | string;
    chartRequest: Chart;
  }): Promise<boolean>;
  canExecuteSegmentQuery(params: {
    userId: number | string;
    collectionName: string;
    renderingId: number | string;
    segmentQuery: string;
    connectionName?: string;
  }): Promise<boolean>;

  getConditionalTriggerCondition(params: {
    userId: number | string;
    customActionName: string;
    collectionName: string;
  }): Promise<RawTreeWithSources | undefined>;
  getConditionalRequiresApprovalCondition(params: {
    userId: number | string;
    customActionName: string;
    collectionName: string;
  }): Promise<RawTreeWithSources | undefined>;
  getConditionalApproveCondition(params: {
    userId: number | string;
    customActionName: string;
    collectionName: string;
  }): Promise<RawTreeWithSources | undefined>;

  getConditionalApproveConditions(params: {
    customActionName: string;
    collectionName: string;
  }): Promise<Map<number, RawTreeWithSources> | undefined>;
  getRoleIdsAllowedToApproveWithoutConditions(params: {
    customActionName: string;
    collectionName: string;
  }): Promise<Array<number>>;
}

export interface ChartHandlerInterface {
  getChartWithContextInjected(params: {
    userId: string | number;
    renderingId: string | number;
    chartRequest: ChartRequest;
  }): Promise<Chart>;
  getQueryForChart(params: {
    userId: string | number;
    renderingId: string | number;
    chartRequest: ChartRequest<QueryChart>;
  }): Promise<{ query: string; contextVariables: Record<string, unknown> }>;
}

export interface ContextVariablesInstantiatorInterface {
  buildContextVariables(params: {
    requestContextVariables?: RequestContextVariables;
    renderingId: string | number;
    userId: string | number;
  }): Promise<ContextVariables>;
}

/**
 * Schema field definition from Forest Admin.
 */
export interface ForestSchemaField {
  field: string;
  type: string;
  isFilterable?: boolean;
  isSortable?: boolean;
  enum: string[] | null;
  inverseOf?: string | null;
  reference: string | null;
  isReadOnly: boolean;
  isRequired: boolean;
  integration?: string | null;
  validations?: unknown[];
  defaultValue?: unknown;
  isPrimaryKey: boolean;
  relationship?: 'HasMany' | 'BelongsToMany' | 'BelongsTo' | 'HasOne' | null;
}

/**
 * Schema action definition from Forest Admin.
 */
export interface ForestSchemaAction {
  id: string;
  name: string;
  type: 'single' | 'bulk' | 'global';
  endpoint: string;
  description?: string;
  submitButtonLabel?: string;
  download: boolean;
  fields: { field: string }[];
  hooks: {
    load: boolean;
    change: unknown[];
  };
}

/**
 * Schema collection definition from Forest Admin.
 */
export interface ForestSchemaCollection {
  name: string;
  fields: ForestSchemaField[];
  actions?: ForestSchemaAction[];
}

/**
 * Activity log response from the Forest Admin server.
 */
export interface ActivityLogResponse {
  id: string;
  attributes: {
    index: string;
  };
}

/**
 * Valid activity log actions.
 */
export type ActivityLogAction =
  | 'index'
  | 'search'
  | 'filter'
  | 'action'
  | 'create'
  | 'update'
  | 'delete'
  | 'listRelatedData'
  | 'describeCollection';

export type ActivityLogType = 'read' | 'write';

export interface CreateActivityLogParams {
  forestServerToken: string;
  renderingId: string;
  action: ActivityLogAction;
  type: ActivityLogType;
  collectionName?: string;
  recordId?: string | number;
  recordIds?: string[] | number[];
  label?: string;
}

export interface UpdateActivityLogStatusParams {
  forestServerToken: string;
  activityLog: ActivityLogResponse;
  status: 'completed' | 'failed';
  errorMessage?: string;
}

/**
 * Service interface for activity logs operations (MCP-related).
 */
export interface ActivityLogsServiceInterface {
  createActivityLog: (params: CreateActivityLogParams) => Promise<ActivityLogResponse>;
  updateActivityLogStatus: (params: UpdateActivityLogStatusParams) => Promise<void>;
}

/**
 * Service interface for schema operations (extended for MCP).
 */
export interface SchemaServiceInterface {
  getSchema: () => Promise<ForestSchemaCollection[]>;
}

export interface ForestAdminServerInterface {
  getEnvironmentPermissions: (...args) => Promise<EnvironmentPermissionsV4>;
  getUsers: (...args) => Promise<UserPermissionV4[]>;
  getRenderingPermissions: (renderingId: number, ...args) => Promise<RenderingPermissionV4>;
  getModelCustomizations: (options: HttpOptions) => Promise<ModelCustomization[]>;
  getMcpServerConfigs: (options: HttpOptions) => Promise<McpConfiguration>;
  makeAuthService(options: ForestAdminClientOptionsWithDefaults): ForestAdminAuthServiceInterface;

  // Schema operations
  getSchema: (options: HttpOptions) => Promise<ForestSchemaCollection[]>;
  postSchema: (options: HttpOptions, schema: object) => Promise<void>;
  checkSchemaHash: (options: HttpOptions, hash: string) => Promise<{ sendSchema: boolean }>;

  // IP whitelist operations
  getIpWhitelistRules: (options: HttpOptions) => Promise<{
    data: {
      attributes: {
        use_ip_whitelist: boolean;
        rules: Array<
          | { type: 0; ip: string }
          | { type: 1; ipMinimum: string; ipMaximum: string }
          | { type: 2; range: string }
        >;
      };
    };
  }>;

  // Activity logs operations
  createActivityLog: (
    options: HttpOptions,
    bearerToken: string,
    body: object,
    headers?: Record<string, string>,
  ) => Promise<ActivityLogResponse>;
  updateActivityLogStatus: (
    options: HttpOptions,
    bearerToken: string,
    index: string,
    id: string,
    body: object,
    headers?: Record<string, string>,
  ) => Promise<void>;
}
