export enum ServerEventType {
  RefreshUsers = 'refresh-users',
  RefreshRoles = 'refresh-roles',
  RefreshRenderings = 'refresh-renderings',
}

export type ServerEvent = MessageEvent & {
  data: {
    type: `${ServerEventType}`;
    data?: unknown;
  };
};
