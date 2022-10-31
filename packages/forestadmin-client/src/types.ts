import type { ChartRequest } from './charts/chart-handler';
import type { Chart, QueryChart } from './charts/types';
import type { CollectionActionEvent } from './permissions/types';
import type { GenericTree } from '@forestadmin/datasource-toolkit';

import ContextVariables, { RequestContextVariables } from './utils/context-variables';

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

  getScope(params: {
    renderingId: number | string;
    userId: number | string;
    collectionName: string;
  }): Promise<GenericTree>;
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
