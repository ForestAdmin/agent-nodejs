import { ServerUtils } from '@forestadmin/forestadmin-client';

export type ApprovalRequestPayload = {
  collectionName: string;
  actionName: string;
  recordIds: (string | number)[];
  values: Record<string, unknown>;
  roleIdsAllowedToApprove?: number[];
};

// TODO(PRD-288 / Brice): confirm the SaaS endpoint + payload used by the front to create an
// approval request after a 403. The front already calls it; once known, replace this placeholder.
const APPROVAL_REQUEST_PATH = '/liana/action-approval-requests';

export default class ApprovalRequestCreator {
  constructor(private readonly options: { forestServerUrl: string; bearerToken: string }) {}

  async create(payload: ApprovalRequestPayload): Promise<void> {
    await ServerUtils.queryWithBearerToken({
      forestServerUrl: this.options.forestServerUrl,
      bearerToken: this.options.bearerToken,
      method: 'post',
      path: APPROVAL_REQUEST_PATH,
      body: {
        data: {
          type: 'action-approval-requests',
          attributes: {
            collection_name: payload.collectionName,
            action_name: payload.actionName,
            ids: payload.recordIds,
            values: payload.values,
            role_ids_allowed_to_approve: payload.roleIdsAllowedToApprove,
          },
        },
      },
    });
  }
}
