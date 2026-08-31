import type { AddressInfo } from 'net';

import http from 'http';

import createAgentHttpRequester from '../../src/agent/create-agent-http-requester';
import { mapAgentError } from '../../src/http/agent-error-mapper';

const TIMEOUT_MS = 50;

function listen(server: http.Server): Promise<string> {
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise(resolve => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}

async function callAgent(url: string): Promise<unknown> {
  const requester = createAgentHttpRequester('tok', url, TIMEOUT_MS);

  return requester.query({ method: 'get', path: '/forest/users' }).then(
    () => undefined,
    error => error,
  );
}

describe('agent transport failures reaching mapAgentError', () => {
  const logger = jest.fn();

  it('reports an agent that accepts the connection but never answers as agent_timeout (504)', async () => {
    const silent = http.createServer(() => undefined);
    const url = await listen(silent);

    try {
      expect(mapAgentError(await callAgent(url), { logger })).toMatchObject({
        type: 'agent_timeout',
        status: 504,
        message: 'The agent did not respond in time',
      });
    } finally {
      await close(silent);
    }
  });

  it('reports an agent refusing the connection as network_error (502)', async () => {
    const closed = http.createServer(() => undefined);
    const url = await listen(closed);
    await close(closed);

    expect(mapAgentError(await callAgent(url), { logger })).toMatchObject({
      type: 'network_error',
      status: 502,
    });
  });
});
