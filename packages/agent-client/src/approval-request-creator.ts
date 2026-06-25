import { ServerUtils } from '@forestadmin/forestadmin-client';

export type ApprovalRequestPayload = {
  collectionName: string;
  actionName: string;
  recordIds: (string | number)[];
  values: Record<string, unknown>;
};

// forestadmin-server private-api: POST /api/action-approvals (status null = creation).
const APPROVAL_REQUEST_PATH = '/api/action-approvals';

export default class ApprovalRequestCreator {
  constructor(
    private readonly options: {
      forestServerUrl: string;
      forestServerToken: string;
      renderingId: number | string;
    },
  ) {}

  async create(payload: ApprovalRequestPayload): Promise<void> {
    await ServerUtils.queryWithBearerToken({
      forestServerUrl: this.options.forestServerUrl,
      bearerToken: this.options.forestServerToken,
      method: 'post',
      path: APPROVAL_REQUEST_PATH,
      headers: { 'forest-rendering-id': String(this.options.renderingId) },
      body: {
        data: {
          type: 'action-approvals',
          attributes: {
            status: null,
            action_name: payload.actionName,
            collection_name: payload.collectionName,
            record_ids: payload.recordIds,
            inputs: payload.values,
          },
        },
      },
    });
  }
}
