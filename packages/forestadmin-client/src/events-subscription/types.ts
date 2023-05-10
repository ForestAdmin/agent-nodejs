export enum ServerEventType {
  RefreshUsers = 'refresh-users',
  RefreshRoles = 'refresh-roles',
  RefreshRenderings = 'refresh-renderings',
  RefreshCustomizations = 'refresh-customizations',
}

export type ServerEvent = MessageEvent & {
  data: {
    type: `${ServerEventType}`;
    data?: unknown;
  };
};
