import { ServerUtils } from '@forestadmin/forestadmin-client';

export type ApprovalRequestInput = { name: string; type: string | string[]; value: unknown };

export type ApprovalRequestPayload = {
  collectionName: string;
  actionName: string;
  recordIds: (string | number)[];
  inputs: ApprovalRequestInput[];
};

export type CreateApprovalRequest = (
  payload: ApprovalRequestPayload,
) => Promise<{ id: string } | undefined>;

const APPROVAL_REQUEST_PATH = '/api/action-approvals';

// The Forest server returns the created approval as JSON:API; the id is the resource id.
type ApprovalCreateResponse = { data?: { id?: string | number } };

function extractApprovalId(body: ApprovalCreateResponse | undefined): { id: string } | undefined {
  const id = body?.data?.id;

  return id ? { id: String(id) } : undefined;
}

export default function makeCreateApprovalRequest(options: {
  forestServerUrl: string;
  forestServerToken: string;
  renderingId: number | string;
}): CreateApprovalRequest {
  return async payload => {
    const body = await ServerUtils.queryWithBearerToken<ApprovalCreateResponse>({
      forestServerUrl: options.forestServerUrl,
      bearerToken: options.forestServerToken,
      method: 'post',
      path: APPROVAL_REQUEST_PATH,
      headers: { 'forest-rendering-id': String(options.renderingId) },
      body: {
        data: {
          type: 'action-approvals',
          attributes: {
            // Required null on create: the Forest server assigns the pending status itself.
            status: null,
            action_name: payload.actionName,
            collection_name: payload.collectionName,
            record_ids: payload.recordIds,
            inputs: payload.inputs,
          },
        },
      },
    });

    return extractApprovalId(body);
  };
}
