import type { GenericTree } from '@forestadmin/datasource-toolkit';

import { CollectionActionEvent, User } from './permissions/types';

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
    renderingId: number;
    user: User;
    collectionName: string;
  }): Promise<GenericTree>;
  markScopesAsUpdated(renderingId: number);
}

export interface PermissionService {
  canOnCollection(params: {
    userId: number;
    event: CollectionActionEvent;
    collectionName: string;
  }): Promise<boolean>;
  canTriggerCustomAction(params: {
    userId: number;
    customActionName: string;
    collectionName: string;
  }): Promise<boolean>;
  canApproveCustomAction(params: {
    userId: number;
    customActionName: string;
    collectionName: string;
    requesterId: number;
  }): Promise<boolean>;
  canRequestCustomActionParameters(params: {
    userId: number;
    collectionName: string;
    customActionName: string;
  }): Promise<boolean>;
  canRetrieveChart(params: {
    renderingId: number;
    userId: number;
    chartRequest: unknown;
  }): Promise<boolean>;
  canExecuteSegmentQuery(params: {
    userId: number;
    collectionName: string;
    renderingId: number;
    segmentQuery: string;
  }): Promise<boolean>;
}
