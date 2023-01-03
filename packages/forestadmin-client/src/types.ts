import type { ChartRequest } from './charts/chart-handler';
import type { Chart, QueryChart } from './charts/types';
import type { Client } from 'openid-client';

import { UserInfo } from './auth/types';
import { IpWhitelistConfiguration } from './ip-whitelist/types';
import {
  CollectionActionEvent,
  EnvironmentPermissionsV4,
  RawTree,
  RawTreeWithSources,
  RenderingPermissionV4,
  UserPermissionV4,
} from './permissions/types';
import { ForestServerCollection } from './schema/types';
import ContextVariables, { RequestContextVariables } from './utils/context-variables';

export type { CollectionActionEvent, RawTree, RawTreeWithSources } from './permissions/types';

export type LoggerLevel = 'Debug' | 'Info' | 'Warn' | 'Error';
export type Logger = (level: LoggerLevel, message: unknown) => void;

export type ForestAdminClientOptions = {
  envSecret: string;
  forestServerUrl?: string;
  logger?: Logger;
  permissionsCacheDurationInSeconds?: number;
};

export type ForestAdminClientOptionsWithDefaults = Required<ForestAdminClientOptions>;

export interface ForestAdminClient {
  readonly permissionService: PermissionService;
  readonly contextVariablesInstantiator: ContextVariablesInstantiatorInterface;
  readonly chartHandler: ChartHandlerInterface;

  verifySignedActionParameters<TSignedParameters>(signedParameters: string): TSignedParameters;

  getIpWhitelistConfiguration(): Promise<IpWhitelistConfiguration>;

  postSchema(
    schema: ForestServerCollection[],
    agentName: string,
    agentVersion: string,
  ): Promise<boolean>;
  getOpenIdClient(): Promise<Client>;

  getUserInfo(renderingId: number, accessToken: string): Promise<UserInfo>;

  getScope(params: {
    renderingId: number | string;
    userId: number | string;
    collectionName: string;
  }): Promise<RawTree>;
  markScopesAsUpdated(renderingId: number | string): void;
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

export type HttpOptions = Pick<
  ForestAdminClientOptionsWithDefaults,
  'envSecret' | 'forestServerUrl'
>;

export interface ForestServerRepository {
  getEnvironmentPermissions: (options: HttpOptions) => Promise<EnvironmentPermissionsV4>;
  getUsers: (options: HttpOptions) => Promise<UserPermissionV4[]>;
  getRenderingPermissions: (
    renderingId: number,
    options: HttpOptions,
  ) => Promise<RenderingPermissionV4>;
}
