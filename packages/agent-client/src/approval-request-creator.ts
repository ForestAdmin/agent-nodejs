import { ServerUtils } from '@forestadmin/forestadmin-client';

export type ApprovalRequestInput = { name: string; type: string | string[]; value: unknown };

export type ApprovalRequestPayload = {
  collectionName: string;
  actionName: string;
  recordIds: (string | number)[];
  inputs: ApprovalRequestInput[];
  message?: string;
};

export type CreateApprovalRequest = (
  payload: ApprovalRequestPayload,
) => Promise<{ id: string } | undefined>;

const APPROVAL_REQUEST_PATH = '/api/action-approvals';

export default function makeCreateApprovalRequest(options: {
  forestServerUrl: string;
  forestServerToken: string;
  renderingId: number | string;
}): CreateApprovalRequest {
  return async payload => {
    // JSON:API create response — the created approval's id is the resource id (data.id).
    const body = await ServerUtils.queryWithBearerToken<{ data?: { id?: string | number } }>({
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

    const id = body?.data?.id ? String(body.data.id) : undefined;

    if (id && payload.message) {
      // Best-effort: the approval already exists, so a comment failure must not turn the
      // successful request into an error.
      try {
        await ServerUtils.queryWithBearerToken({
          forestServerUrl: options.forestServerUrl,
          bearerToken: options.forestServerToken,
          method: 'post',
          path: `${APPROVAL_REQUEST_PATH}/${id}/comments`,
          headers: { 'forest-rendering-id': String(options.renderingId) },
          body: { data: { attributes: { comment: payload.message } } },
        });
      } catch (error) {
        // The approval already exists; the comment is optional context, so don't fail the
        // request. Warn (rather than swallow silently) so a persistently broken comments
        // route — or a bug in this block — is discoverable.
        // eslint-disable-next-line no-console
        console.warn(
          `Approval request ${id} created, but posting the reasoning comment failed`,
          error,
        );
      }
    }

    return id ? { id } : undefined;
  };
}
