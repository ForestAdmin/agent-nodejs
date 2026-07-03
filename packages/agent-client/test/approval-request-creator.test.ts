import { ServerUtils } from '@forestadmin/forestadmin-client';

import makeCreateApprovalRequest from '../src/approval-request-creator';

jest.mock('@forestadmin/forestadmin-client', () => ({
  ServerUtils: { queryWithBearerToken: jest.fn() },
}));

describe('makeCreateApprovalRequest', () => {
  const queryWithBearerToken = ServerUtils.queryWithBearerToken as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  it('POSTs /api/action-approvals with the server token, rendering id header and payload', async () => {
    const create = makeCreateApprovalRequest({
      forestServerUrl: 'https://api.forestadmin.com',
      forestServerToken: 'server-token',
      renderingId: 42,
    });

    await create({
      collectionName: 'users',
      actionName: 'refund',
      recordIds: ['1', '2'],
      inputs: [{ name: 'reason', type: 'String', value: 'fraud' }],
    });

    expect(queryWithBearerToken).toHaveBeenCalledWith({
      forestServerUrl: 'https://api.forestadmin.com',
      bearerToken: 'server-token',
      method: 'post',
      path: '/api/action-approvals',
      headers: { 'forest-rendering-id': '42' },
      body: {
        data: {
          type: 'action-approvals',
          attributes: {
            status: null,
            action_name: 'refund',
            collection_name: 'users',
            record_ids: ['1', '2'],
            inputs: [{ name: 'reason', type: 'String', value: 'fraud' }],
          },
        },
      },
    });
  });

  it('posts the message as a comment on the created approval', async () => {
    queryWithBearerToken.mockResolvedValueOnce({ data: { id: 'req_42' } });
    const create = makeCreateApprovalRequest({
      forestServerUrl: 'https://api.forestadmin.com',
      forestServerToken: 'server-token',
      renderingId: 42,
    });

    const result = await create({
      collectionName: 'users',
      actionName: 'refund',
      recordIds: ['1'],
      inputs: [],
      message: 'Refund requested by AI: duplicate payment detected',
    });

    expect(queryWithBearerToken).toHaveBeenCalledTimes(2);
    expect(queryWithBearerToken).toHaveBeenLastCalledWith({
      forestServerUrl: 'https://api.forestadmin.com',
      bearerToken: 'server-token',
      method: 'post',
      path: '/api/action-approvals/req_42/comments',
      headers: { 'forest-rendering-id': '42' },
      body: {
        data: { attributes: { comment: 'Refund requested by AI: duplicate payment detected' } },
      },
    });
    expect(result).toEqual({ id: 'req_42' });
  });

  it('skips the comment when no approval id came back', async () => {
    queryWithBearerToken.mockResolvedValueOnce({ data: {} });
    const create = makeCreateApprovalRequest({
      forestServerUrl: 'https://api.forestadmin.com',
      forestServerToken: 'server-token',
      renderingId: 42,
    });

    await create({
      collectionName: 'users',
      actionName: 'refund',
      recordIds: ['1'],
      inputs: [],
      message: 'some reasoning',
    });

    expect(queryWithBearerToken).toHaveBeenCalledTimes(1);
  });

  it('still returns the approval id when posting the comment fails', async () => {
    queryWithBearerToken
      .mockResolvedValueOnce({ data: { id: 'req_42' } })
      .mockRejectedValueOnce(new Error('comments route down'));
    const create = makeCreateApprovalRequest({
      forestServerUrl: 'https://api.forestadmin.com',
      forestServerToken: 'server-token',
      renderingId: 42,
    });

    const result = await create({
      collectionName: 'users',
      actionName: 'refund',
      recordIds: ['1'],
      inputs: [],
      message: 'some reasoning',
    });

    expect(result).toEqual({ id: 'req_42' });
  });

  it('returns the approval id read from the server response data.id', async () => {
    queryWithBearerToken.mockResolvedValue({ data: { id: 'req_42', type: 'action-approvals' } });
    const create = makeCreateApprovalRequest({
      forestServerUrl: 'https://api.forestadmin.com',
      forestServerToken: 'server-token',
      renderingId: 42,
    });

    const result = await create({
      collectionName: 'users',
      actionName: 'refund',
      recordIds: ['1'],
      inputs: [],
    });

    expect(result).toEqual({ id: 'req_42' });
  });

  it('returns undefined (no throw) when the response carries no usable id', async () => {
    queryWithBearerToken.mockResolvedValue({ data: { attributes: { status: 'pending' } } });
    const create = makeCreateApprovalRequest({
      forestServerUrl: 'https://api.forestadmin.com',
      forestServerToken: 'server-token',
      renderingId: 42,
    });

    await expect(
      create({ collectionName: 'users', actionName: 'refund', recordIds: ['1'], inputs: [] }),
    ).resolves.toBeUndefined();
  });
});
