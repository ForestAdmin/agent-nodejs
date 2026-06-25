import { ServerUtils } from '@forestadmin/forestadmin-client';

export type ApprovalRequestPayload = {
  collectionName: string;
  actionName: string;
  recordIds: (string | number)[];
  values: Record<string, unknown>;
};

export type CreateApprovalRequest = (payload: ApprovalRequestPayload) => Promise<void>;

// forestadmin-server private-api: POST /api/action-approvals (status null = creation).
const APPROVAL_REQUEST_PATH = '/api/action-approvals';

export default function makeCreateApprovalRequest(options: {
  forestServerUrl: string;
  forestServerToken: string;
  renderingId: number | string;
}): CreateApprovalRequest {
  return async payload => {
    await ServerUtils.queryWithBearerToken({
      forestServerUrl: options.forestServerUrl,
      bearerToken: options.forestServerToken,
      method: 'post',
      path: APPROVAL_REQUEST_PATH,
      headers: { 'forest-rendering-id': String(options.renderingId) },
      body: {
        data: {
          type: 'action-approvals',
          attributes: {
            status: null,
            action_name: payload.actionName,
            collection_name: payload.collectionName,
            record_ids: payload.recordIds,
            // The Forest server stores inputs as a list of { name, value } (not a values map).
            inputs: Object.entries(payload.values).map(([name, value]) => ({ name, value })),
          },
        },
      },
    });
  };
}
