/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger, LoggerLevel } from '@forestadmin/datasource-toolkit';

/** Options to configure behavior of an agent's forestadmin driver */
export type BuilderOptions = {
  isProduction: boolean;
  logger?: Logger;
  loggerLevel?: LoggerLevel;
  typingsPath?: string;
  typingsMaxDepth?: number;
};

export type AgentServerOptions = {
  agentUrl: string;
  authSecret: string;
  clientId?: string;
  envSecret: string;
  forestServerUrl?: string;
  prefix?: string;
  schemaPath?: string;
  permissionsCacheDurationInSeconds?: number;
  mountPoint: MountOptions;
};

export type RpcServerOptions = {
  psk: string;
  mountPoint: MountOptions;
};

type MountPointExpress = { type: 'express'; application: any };
type MountPointKoa = { type: 'koa'; application: any };
type MountPointNestJs = { type: 'nestjs'; application: any };
type MountPointFastify = { type: 'fastify'; application: any };
type MountPointStandalone = { type: 'standalone'; port?: number; host?: string };

export type MountOptions =
  | MountPointExpress
  | MountPointKoa
  | MountPointNestJs
  | MountPointFastify
  | MountPointStandalone;
