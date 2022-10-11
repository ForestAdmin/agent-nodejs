import type { GenericTree } from '@forestadmin/datasource-toolkit';

import {
  CollectionActionEvent,
  SmartActionApprovalRequestBody,
  SmartActionRequestBody,
  User,
} from './permissions/types';

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
  canOnCollection(params: {
    userId: number;
    event: CollectionActionEvent;
    collectionName: string;
  }): Promise<boolean>;
  canExecuteCustomAction(params: {
    userId: number;
    customActionName: string;
    collectionName: string;
    body: SmartActionRequestBody | SmartActionApprovalRequestBody;
  }): Promise<false | SmartActionRequestBody>;
  canExecuteCustomActionHook(params: {
    userId: number;
    collectionName: string;
    customActionName: string;
  }): Promise<boolean>;
  getScope(params: {
    renderingId: number;
    user: User;
    collectionName: string;
  }): Promise<GenericTree>;
  canRetrieveChart(params: {
    renderingId: number;
    userId: number;
    chartRequest: SmartActionApprovalRequestBody | SmartActionRequestBody;
  }): Promise<boolean>;
  markScopesAsUpdated(renderingId: number);
}
