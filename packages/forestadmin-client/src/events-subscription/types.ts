export enum ServerEventType {
  RefreshUsers = 'refresh-users',
  RefreshRoles = 'refresh-roles',
  RefreshRenderings = 'refresh-renderings',
  RefreshCustomizations = 'refresh-customizations',
}

export type ServerEvent = MessageEvent<{
  type: `${ServerEventType}`;
  data?: string;
}>;

export interface RefreshEventsHandlerService {
  refreshUsers: () => Promise<void> | void;
  refreshRoles: () => Promise<void> | void;
  refreshRenderings: (renderingIds: [string | number]) => Promise<void> | void;
  refreshCustomizations: () => Promise<void> | void;
  onRefreshCustomizations: (handler: () => void | Promise<void>) => void;

  refreshEverything: () => Promise<void> | void;
}

/**
 * Allows to subscribe to the Server Events.
 */
export interface BaseEventsSubscriptionService {
  subscribeEvents(): Promise<void>;
  close(): void;
}
