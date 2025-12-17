import { RawTreeWithSources } from '@forestadmin/forestadmin-client';

import { ActionEndpointsByCollection } from './action';
import Chart from './chart';
import Collection from './collection';
import HttpRequester from '../http-requester';

export type SmartActionPermissionsOverride = Partial<{
  triggerEnabled: boolean;
  triggerConditions: RawTreeWithSources;
  approvalRequired: boolean;
  approvalRequiredConditions: RawTreeWithSources;
  userApprovalEnabled: boolean;
  userApprovalConditions: RawTreeWithSources;
  selfApprovalEnabled: boolean;
}>;

export type CollectionPermissionsOverride = Partial<{
  browseEnabled: boolean;
  deleteEnabled: boolean;
  editEnabled: boolean;
  exportEnabled: boolean;
  addEnabled: boolean;
  readEnabled: boolean;
}>;

export type PermissionsOverride = Record<
  string,
  {
    collection: CollectionPermissionsOverride;
    actions: Record<string, SmartActionPermissionsOverride>;
  }
>;

type CollectionName<T> = keyof T & string;

export default class RemoteAgentClient<
  TypingsSchema extends Record<string, unknown> = Record<string, unknown>,
> extends Chart {
  protected actionEndpoints?: ActionEndpointsByCollection;

  private overridePermissions?: (permissions: PermissionsOverride) => Promise<void>;

  constructor(params?: {
    actionEndpoints?: ActionEndpointsByCollection;
    httpRequester: HttpRequester;
    overridePermissions?: (permissions: PermissionsOverride) => Promise<void>;
  }) {
    super();
    if (!params) return;
    this.httpRequester = params.httpRequester;
    this.actionEndpoints = params.actionEndpoints;
    this.overridePermissions = params.overridePermissions;
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

  collection(name: CollectionName<TypingsSchema>): Collection<TypingsSchema> {
    return new Collection<TypingsSchema>(name, this.httpRequester, this.actionEndpoints);
  }
}
