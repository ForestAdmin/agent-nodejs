import { AgentHttpError } from '@forestadmin/agent-client';

import { mapAgentError } from '../../src/http/agent-error-mapper';

function jsonApiBody(error: {
  name?: string;
  detail?: string;
  message?: string;
  status?: number | string;
  data?: unknown;
}) {
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

  it.each([
    ['ValidationError', 'validation_error'],
    ['BadRequestError', 'invalid_request'],
    ['UnauthorizedError', 'unauthorized'],
    ['ForbiddenError', 'forbidden'],
    ['NotFoundError', 'not_found'],
    ['UnprocessableError', 'unprocessable_entity'],
    ['TooManyRequestsError', 'too_many_requests'],
  ])('maps agent name %s to type %s', (name, type) => {
    const status = 422;
    const error = new AgentHttpError(status, jsonApiBody({ name, status, detail: 'd' }));

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({ type, status });
  });

  it('coerces a spec-compliant string JSON:API status to a number', () => {
    const error = new AgentHttpError(
      404,
      jsonApiBody({ name: 'NotFoundError', status: '404', detail: 'x' }),
    );

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({ type: 'not_found', status: 404 });
    expect(typeof result.status).toBe('number');
  });

  it('uses the outer AgentHttpError status when the JSON:API error omits it', () => {
    const error = new AgentHttpError(403, jsonApiBody({ name: 'ForbiddenError', detail: 'no' }));

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({ type: 'forbidden', status: 403 });
  });

  it('falls back to the JSON:API message when detail is absent', () => {
    const error = new AgentHttpError(
      404,
      jsonApiBody({ name: 'NotFoundError', status: 404, message: 'gone' }),
    );

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({ type: 'not_found', status: 404, message: 'gone' });
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

  it('falls back to responseText when the agent body is not a JSON error object', () => {
    const result = mapAgentError(new AgentHttpError(400, 'oops', 'Bad things happened'), {
      logger,
    });

    expect(result).toMatchObject({
      type: 'invalid_request',
      status: 400,
      message: 'Bad things happened',
    });
  });

  it('maps an unmapped agent error name to mapping_error (500) and logs it', () => {
    const error = new AgentHttpError(
      400,
      jsonApiBody({ name: 'MissingCollectionError', status: 400, detail: 'gone' }),
    );

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({ type: 'mapping_error', status: 500 });
    expect(logger).toHaveBeenCalledWith(
      'Error',
      expect.any(String),
      expect.objectContaining({ name: 'MissingCollectionError' }),
    );
  });
});
