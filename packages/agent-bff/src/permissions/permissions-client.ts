import type { EnvironmentPermissionsV4, UserPermissionV4 } from '@forestadmin/forestadmin-client';

import { ForestHttpApi } from '@forestadmin/forestadmin-client';

export interface PermissionsClientOptions {
  forestServerUrl: string;
  envSecret: string;
}

export interface EnvironmentAndUserPermissions {
  environmentPermissions: EnvironmentPermissionsV4;
  users: UserPermissionV4[];
}

export interface PermissionsFetcher {
  fetchPermissions(): Promise<EnvironmentAndUserPermissions>;
}

export default class PermissionsClient implements PermissionsFetcher {
  private readonly api: ForestHttpApi;
  private readonly options: PermissionsClientOptions;

  constructor(options: PermissionsClientOptions) {
    this.api = new ForestHttpApi();
    this.options = options;
  }

  async fetchPermissions(): Promise<EnvironmentAndUserPermissions> {
    const [environmentPermissions, users] = await Promise.all([
      this.api.getEnvironmentPermissions(this.options),
      this.api.getUsers(this.options),
    ]);

    return { environmentPermissions, users };
  }
}
