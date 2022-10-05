import { CompositeId, Logger, LoggerLevel } from '@forestadmin/datasource-toolkit';
import {
  GenericTree,
  SmartActionApprovalRequestBody,
  SmartActionRequestBody,
} from '@forestadmin/forestadmin-client';
import { IncomingMessage, ServerResponse } from 'http';

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
  permissionsCacheDurationInSeconds?: number;
  forestAdminClient?: ForestAdminClient;
};
export type AgentOptionsWithDefaults = Readonly<Required<AgentOptions>>;

export type HttpCallback = (req: IncomingMessage, res: ServerResponse) => void;

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

export type User = Record<string, any> & {
  id: number;
  renderingId: number;
  tags: Record<string, string>;
};

export interface ForestAdminClient {
  canBrowse(userId: number, collectionName: string): Promise<boolean>;
  canRead(userId: number, collectionName: string): Promise<boolean>;
  canAdd(userId: number, collectionName: string): Promise<boolean>;
  canEdit(userId: number, collectionName: string): Promise<boolean>;
  canDelete(userId: number, collectionName: string): Promise<boolean>;
  canExport(userId: number, collectionName: string): Promise<boolean>;
  canExecuteCustomAction(params: {
    userId: number;
    customActionName: string;
    collectionName: string;
    body: SmartActionRequestBody | SmartActionApprovalRequestBody;
  }): Promise<false | SmartActionRequestBody>;
  canExecuteCustomActionHook(params: {
    userId: number;
    customActionName: string;
    collectionName: string;
  }): Promise<boolean>;
  getScope(user: User, collectionName: string): Promise<GenericTree>;
  canRetrieveChart({
    renderingId,
    userId,
    chartRequest,
  }: {
    renderingId: number;
    userId: number;
    chartRequest: any;
  }): Promise<boolean>;
  markScopesAsUpdated(renderingId: number): void;
}
