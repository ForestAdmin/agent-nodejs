import type { ActionEndpointsByCollection } from './action';
import type { ActivityLogContext } from '../activity-log/with-activity-log';
import type { CreateApprovalRequest } from '../approval-request-creator';
import type HttpRequester from '../http-requester';
import type { AgentSchema } from '../schema/agent-schema';
import type { RawTreeWithSources } from '@forestadmin/forestadmin-client';

import Chart from './chart';
import Collection from './collection';

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
  readonly schema?: AgentSchema;
  protected createApprovalRequest?: CreateApprovalRequest;
  protected activityLog?: ActivityLogContext;

  private overridePermissions?: (permissions: PermissionsOverride) => Promise<void>;

  constructor(params?: {
    actionEndpoints?: ActionEndpointsByCollection;
    schema?: AgentSchema;
    httpRequester: HttpRequester;
    overridePermissions?: (permissions: PermissionsOverride) => Promise<void>;
    createApprovalRequest?: CreateApprovalRequest;
    activityLog?: ActivityLogContext;
  }) {
    super();
    if (!params) return;
    this.httpRequester = params.httpRequester;
    this.schema = params.schema;
    this.actionEndpoints = params.actionEndpoints ?? params.schema?.actionEndpoints;
    this.overridePermissions = params.overridePermissions;
    this.createApprovalRequest = params.createApprovalRequest;
    this.activityLog = params.activityLog;
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

  collection(name: CollectionName<TypingsSchema>): Collection {
    return new Collection(
      name,
      this.httpRequester,
      this.actionEndpoints,
      this.createApprovalRequest,
      this.activityLog,
    );
  }
}
