import type { WriteStream } from 'fs';

import { HttpRequester } from '@forestadmin/agent-client';

import createAgentHttpRequester, {
  AgentTimeoutError,
} from '../../src/agent/create-agent-http-requester';

jest.mock('@forestadmin/agent-client');

const mockedHttpRequester = jest.mocked(HttpRequester);

describe('createAgentHttpRequester', () => {
  const query = jest.fn();
  const stream = jest.fn();

  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue([]);
    stream.mockReset();
    stream.mockResolvedValue(undefined);
    mockedHttpRequester.mockReset();
    mockedHttpRequester.mockImplementation(() => ({ query, stream } as unknown as HttpRequester));
  });

  it('should leave maxTimeAllowed unset when no timeout is configured', async () => {
    const requester = createAgentHttpRequester('tok', 'https://agent.example.com');

    await requester.query({ method: 'get', path: '/forest/users' });

    expect(HttpRequester).toHaveBeenCalledWith('tok', { url: 'https://agent.example.com' });
    expect(query).toHaveBeenCalledWith({
      method: 'get',
      path: '/forest/users',
      maxTimeAllowed: undefined,
    });
  });

  it.each([
    ['no timeout is configured', undefined],
    ['a timeout is configured', 2500],
  ])('should raise a typed AgentTimeoutError when %s', async (_label, timeoutMs) => {
    query.mockRejectedValue(
      Object.assign(new Error('Timeout of 1500ms exceeded'), {
        code: 'ECONNABORTED',
        errno: 'ETIME',
        timeout: 1500,
      }),
    );

    const requester = createAgentHttpRequester('tok', 'https://agent', timeoutMs);

    await expect(requester.query({ method: 'get', path: '/forest/users' })).rejects.toMatchObject({
      name: 'AgentTimeoutError',
      message: 'Timeout of 1500ms exceeded',
    });
  });

  it('should leave any other transport failure untouched', async () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    query.mockRejectedValue(refused);

    const requester = createAgentHttpRequester('tok', 'https://agent', 2500);

    await expect(requester.query({ method: 'get', path: '/forest/users' })).rejects.toBe(refused);
    await expect(
      requester.query({ method: 'get', path: '/forest/users' }),
    ).rejects.not.toBeInstanceOf(AgentTimeoutError);
  });

  it('should default maxTimeAllowed to the configured timeout on query', async () => {
    const requester = createAgentHttpRequester('tok', 'https://agent', 2500);

    await requester.query({ method: 'get', path: '/forest/users' });

    expect(query).toHaveBeenCalledWith({
      method: 'get',
      path: '/forest/users',
      maxTimeAllowed: 2500,
    });
  });

  it('should keep an explicit per-call maxTimeAllowed on query', async () => {
    const requester = createAgentHttpRequester('tok', 'https://agent', 2500);

    await requester.query({ method: 'get', path: '/forest/users', maxTimeAllowed: 400 });

    expect(query).toHaveBeenCalledWith({
      method: 'get',
      path: '/forest/users',
      maxTimeAllowed: 400,
    });
  });

  it('should default maxTimeAllowed to the configured timeout on stream', async () => {
    const requester = createAgentHttpRequester('tok', 'https://agent', 2500);
    const target = {} as WriteStream;

    await requester.stream({
      path: '/forest/users.csv',
      contentType: 'text/csv',
      stream: target,
    });

    expect(stream).toHaveBeenCalledWith({
      path: '/forest/users.csv',
      contentType: 'text/csv',
      stream: target,
      maxTimeAllowed: 2500,
    });
  });

  it('should keep an explicit per-call maxTimeAllowed on stream', async () => {
    const requester = createAgentHttpRequester('tok', 'https://agent', 2500);
    const target = {} as WriteStream;

    await requester.stream({
      path: '/forest/users.csv',
      contentType: 'text/csv',
      stream: target,
      maxTimeAllowed: 400,
    });

    expect(stream).toHaveBeenCalledWith({
      path: '/forest/users.csv',
      contentType: 'text/csv',
      stream: target,
      maxTimeAllowed: 400,
    });
  });
});
