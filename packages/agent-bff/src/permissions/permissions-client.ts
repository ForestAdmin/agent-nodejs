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

  private inFlight: Promise<EnvironmentAndUserPermissions> | null = null;

  constructor(options: PermissionsClientOptions) {
    this.api = new ForestHttpApi();
    this.options = options;
  }

  fetchPermissions(): Promise<EnvironmentAndUserPermissions> {
    if (!this.inFlight) {
      this.inFlight = this.doFetchPermissions().finally(() => {
        this.inFlight = null;
      });
    }

    return this.inFlight;
  }

  private async doFetchPermissions(): Promise<EnvironmentAndUserPermissions> {
    const [environmentPermissions, users] = await Promise.all([
      this.api.getEnvironmentPermissions(this.options),
      this.api.getUsers(this.options),
    ]);

    return { environmentPermissions, users };
  }
}
