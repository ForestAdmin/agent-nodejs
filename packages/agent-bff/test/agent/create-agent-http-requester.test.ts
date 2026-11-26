import type { WriteStream } from 'fs';

import { HttpRequester } from '@forestadmin/agent-client';

import createAgentHttpRequester from '../../src/agent/create-agent-http-requester';

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
