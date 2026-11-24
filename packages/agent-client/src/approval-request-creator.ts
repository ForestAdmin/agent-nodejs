import type { ActivityLogSource, ForestServerToken } from './forest-server';

import { ServerUtils } from '@forestadmin/forestadmin-client';

import { APPLICATION_SOURCE_HEADER, resolveServerToken } from './forest-server';

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
  forestServerToken: ForestServerToken;
  renderingId: number | string;
  source?: ActivityLogSource;
}): CreateApprovalRequest {
  const headers = {
    'forest-rendering-id': String(options.renderingId),
    ...(options.source && { [APPLICATION_SOURCE_HEADER]: options.source }),
  };

  return async payload => {
    const bearerToken = await resolveServerToken(options.forestServerToken);

    // JSON:API create response — the created approval's id is the resource id (data.id).
    const body = await ServerUtils.queryWithBearerToken<{ data?: { id?: string | number } }>({
      forestServerUrl: options.forestServerUrl,
      bearerToken,
      method: 'post',
      path: APPROVAL_REQUEST_PATH,
      headers,
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

    // Best-effort: the approval already exists, so a comment failure must not fail the request.
    if (id && payload.message) {
      try {
        await ServerUtils.queryWithBearerToken({
          forestServerUrl: options.forestServerUrl,
          bearerToken,
          method: 'post',
          path: `${APPROVAL_REQUEST_PATH}/${id}/comments`,
          headers,
          body: { data: { attributes: { comment: payload.message } } },
        });
      } catch (error) {
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
