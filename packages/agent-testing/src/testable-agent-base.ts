import type {
  CollectionPermissionsOverride,
  PermissionsOverride,
  SmartActionPermissionsOverride,
} from './permission-overrides';
import type { ActionEndpointsByCollection, HttpRequester } from '@forestadmin/agent-client';
import type { TSchema } from '@forestadmin/datasource-customizer';

import { RemoteAgentClient } from '@forestadmin/agent-client';

import Benchmark from './benchmark';

type CollectionName<T> = keyof T & string;

export default class TestableAgentBase<
  TypingsSchema extends TSchema = TSchema,
> extends RemoteAgentClient<TypingsSchema> {
  private readonly overridePermissions?: (permissions: PermissionsOverride) => Promise<void>;

  constructor(params?: {
    actionEndpoints?: ActionEndpointsByCollection;
    httpRequester: HttpRequester;
    overridePermissions?: (permissions: PermissionsOverride) => Promise<void>;
  }) {
    super(params);
    this.overridePermissions = params?.overridePermissions;
  }

  async overrideCollectionPermission(
    collectionName: CollectionName<TypingsSchema>,
    permissions: CollectionPermissionsOverride,
  ) {
    await this.overridePermissions?.({
      [collectionName]: {
        collection: permissions,
        actions: {},
      },
    });
  }

  async overrideActionPermission(
    collectionName: CollectionName<TypingsSchema>,
    actionName: string,
    permissions: SmartActionPermissionsOverride,
  ) {
    await this.overridePermissions?.({
      [collectionName]: {
        collection: {},
        actions: {
          [actionName]: permissions,
        },
      },
    });
  }

  async clearPermissionOverride() {
    await this.overridePermissions?.({});
  }

  benchmark(): Benchmark {
    return new Benchmark();
  }
}
