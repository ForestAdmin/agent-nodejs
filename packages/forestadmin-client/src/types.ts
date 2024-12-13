import type { ChartRequest } from './charts/chart-handler';
import type { Chart, QueryChart } from './charts/types';

import { ParsedUrlQuery } from 'querystring';

import { Tokens, UserInfo } from './auth/types';
import { IpWhitelistConfiguration } from './ip-whitelist/types';
import { ModelCustomization, ModelCustomizationService } from './model-customizations/types';
import { HttpOptions } from './permissions/forest-http-api';
import {
  CollectionActionEvent,
  EnvironmentPermissionsV4,
  RawTree,
  RawTreeWithSources,
  RenderingPermissionV4,
  UserPermissionV4,
} from './permissions/types';
import { ForestSchema } from './schema/types';
import ContextVariables, { RequestContextVariables } from './utils/context-variables';

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
  readonly authService: ForestAdminAuthServiceInterface;

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

export interface ForestAdminServerInterface {
  getEnvironmentPermissions: (...args) => Promise<EnvironmentPermissionsV4>;
  getUsers: (...args) => Promise<UserPermissionV4[]>;
  getRenderingPermissions: (renderingId: number, ...args) => Promise<RenderingPermissionV4>;
  getModelCustomizations: (options: HttpOptions) => Promise<ModelCustomization[]>;
  makeAuthService(options: ForestAdminClientOptionsWithDefaults): ForestAdminAuthServiceInterface;
}
