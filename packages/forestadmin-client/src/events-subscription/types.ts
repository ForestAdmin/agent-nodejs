import EventEmitter from 'events';

export enum ServerEventType {
  RefreshUsers = 'refresh-users',
  RefreshRoles = 'refresh-roles',
  RefreshRenderings = 'refresh-renderings',
  RefreshCustomizations = 'refresh-customizations',
}

export type ServerEvent = MessageEvent<{
  type: `${ServerEventType}`;
  data?: unknown;
}>;

export interface RefreshEventsHandlerService extends EventEmitter {
  onRefreshUsers: () => Promise<void> | void;
  onRefreshRoles: () => Promise<void> | void;
  onRefreshRenderings: (renderingIds: [string | number]) => Promise<void> | void;

  refreshEverything: () => Promise<void> | void;
}
