import type { GenericTree } from '@forestadmin/datasource-toolkit';

import { CollectionActionEvent } from './permissions/types';

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
  canRetrieveChart(params: {
    renderingId: number | string;
    userId: number | string;
    chartRequest: unknown;
  }): Promise<boolean>;
  canExecuteSegmentQuery(params: {
    userId: number | string;
    collectionName: string;
    renderingId: number | string;
    segmentQuery: string;
  }): Promise<boolean>;

  getConditionalTriggerFilter(params: {
    userId: number | string;
    customActionName: string;
    collectionName: string;
  }): Promise<GenericTree>;
  getConditionalRequiresApprovalFilter(params: {
    userId: number | string;
    customActionName: string;
    collectionName: string;
  }): Promise<GenericTree>;
  getConditionalApproveFilter(params: {
    userId: number | string;
    customActionName: string;
    collectionName: string;
  }): Promise<GenericTree>;

  getConditionalApproveFilters(params: {
    customActionName: string;
    collectionName: string;
  }): Promise<Array<{ roleIds: number[]; filterGenericTree: GenericTree }>>;
}
