import type { TSchema } from '@forestadmin/agent';

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

export default class RemoteAgentClient<TypingsSchema extends TSchema = TSchema> extends Chart {
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
    collectionName: keyof TypingsSchema,
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
    collectionName: keyof TypingsSchema,
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

  collection(name: keyof TypingsSchema): Collection<TypingsSchema> {
    return new Collection<TypingsSchema>(name, this.httpRequester, this.actionEndpoints);
  }
}
