import type { InProcessAgentDispatcher } from '../src/in-process-agent-dispatcher';

import { AgentHttpError } from '@forestadmin/agent-client';

import InProcessHttpRequester from '../src/in-process-http-requester';

describe('InProcessHttpRequester', () => {
  function setup(response: { status: number; body: unknown; text: string }) {
    const request = jest.fn().mockResolvedValue(response);
    const dispatcher: InProcessAgentDispatcher = { request };
    const requester = new InProcessHttpRequester('bearer-token', dispatcher);

    return { request, requester };
  }

  it('dispatches the request in-process with auth, content-type and timezone', async () => {
    const { request, requester } = setup({ status: 200, body: { records: [] }, text: '' });

    await requester.query({
      method: 'post',
      path: '/forest/books',
      body: { name: 'x' },
      query: { search: 'foo' },
      skipDeserialization: true,
    });

    expect(request).toHaveBeenCalledWith({
      method: 'post',
      path: '/forest/books',
      headers: {
        Authorization: 'Bearer bearer-token',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      query: { timezone: 'Europe/Paris', search: 'foo' },
      payload: { name: 'x' },
    });
  });

  it('returns the raw body when skipDeserialization is set', async () => {
    const { requester } = setup({ status: 200, body: { id: 1 }, text: '' });

    const result = await requester.query({
      method: 'get',
      path: '/forest/books/1',
      skipDeserialization: true,
    });

    expect(result).toEqual({ id: 1 });
  });

  it('throws an AgentHttpError carrying the status when the agent responds >= 400', async () => {
    const { requester } = setup({ status: 403, body: { error: 'forbidden' }, text: 'forbidden' });

    await expect(
      requester.query({ method: 'post', path: '/forest/books/1/actions/x' }),
    ).rejects.toMatchObject({ constructor: AgentHttpError, status: 403 });
  });

  it('preserves the approval-gate error shape (403 + CustomActionRequiresApprovalError)', async () => {
    const approvalBody = { errors: [{ name: 'CustomActionRequiresApprovalError' }] };
    const approvalText = JSON.stringify(approvalBody);
    const { requester } = setup({ status: 403, body: approvalBody, text: approvalText });

    const error = (await requester
      .query({ method: 'post', path: '/forest/books/1/actions/x' })
      .catch(e => e)) as AgentHttpError;

    // domains/action.ts routes on both of these to raise ActionRequiresApprovalError.
    expect(error).toBeInstanceOf(AgentHttpError);
    expect(error.status).toBe(403);
    expect(error.body).toEqual(approvalBody);
    expect(error.responseText).toContain('CustomActionRequiresApprovalError');
  });

  it('forwards maxTimeAllowed to the dispatcher as timeoutMs', async () => {
    const { request, requester } = setup({ status: 200, body: {}, text: '{}' });

    await requester.query({
      method: 'get',
      path: '/forest/books',
      maxTimeAllowed: 2000,
      skipDeserialization: true,
    });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 2000 }));
  });

  it('does not support CSV export in-process', async () => {
    const { requester } = setup({ status: 200, body: null, text: '' });

    await expect(requester.stream()).rejects.toThrow('CSV export is not supported');
  });
});
