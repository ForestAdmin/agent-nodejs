import { AgentHttpError } from '@forestadmin/agent-client';

import { AGENT_ERROR_TYPE_MAP, mapAgentError } from '../../src/http/agent-error-mapper';

function jsonApiBody(error: { name?: string; detail?: string; status?: number; data?: unknown }) {
  return { errors: [error] };
}

describe('mapAgentError', () => {
  let logger: jest.Mock;

  beforeEach(() => {
    logger = jest.fn();
  });

  it('maps a JSON:API NotFoundError to not_found with its detail and data', () => {
    const error = new AgentHttpError(
      404,
      jsonApiBody({ name: 'NotFoundError', status: 404, detail: 'x', data: { id: 1 } }),
    );

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({
      type: 'not_found',
      status: 404,
      message: 'x',
      details: { id: 1 },
    });
  });

  it.each(Object.entries(AGENT_ERROR_TYPE_MAP))('maps agent name %s to type %s', (name, type) => {
    const status = 422;
    const error = new AgentHttpError(status, jsonApiBody({ name, status, detail: 'd' }));

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({ type, status });
  });

  it('parses a JSON:API body carried in a plain Error message', () => {
    const error = new Error(
      JSON.stringify(jsonApiBody({ name: 'ForbiddenError', status: 403, detail: 'nope' })),
    );

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({ type: 'forbidden', status: 403, message: 'nope' });
  });

  it('maps a transport failure to network_error (502)', () => {
    const result = mapAgentError(new Error('ECONNREFUSED'), { logger });

    expect(result).toMatchObject({ type: 'network_error', status: 502 });
  });

  it('normalizes an agent 500 to agent_unavailable (503)', () => {
    const result = mapAgentError(new AgentHttpError(500, {}), { logger });

    expect(result).toMatchObject({ type: 'agent_unavailable', status: 503 });
  });

  it('normalizes an agent 503 to agent_unavailable (503)', () => {
    const result = mapAgentError(new AgentHttpError(503, {}), { logger });

    expect(result).toMatchObject({ type: 'agent_unavailable', status: 503 });
  });

  it('maps a flat native-action body to invalid_request (400) using body.error', () => {
    const result = mapAgentError(new AgentHttpError(400, { error: 'boom' }), { logger });

    expect(result).toMatchObject({ type: 'invalid_request', status: 400, message: 'boom' });
  });

  it('falls back to invalid_request and warns for an unmapped name', () => {
    const error = new AgentHttpError(
      400,
      jsonApiBody({ name: 'MissingCollectionError', status: 400, detail: 'gone' }),
    );

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({ type: 'invalid_request', status: 400 });
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      expect.any(String),
      expect.objectContaining({ name: 'MissingCollectionError' }),
    );
  });
});
