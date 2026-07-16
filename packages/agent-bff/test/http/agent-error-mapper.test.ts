import { AgentHttpError } from '@forestadmin/agent-client';

import { mapAgentError } from '../../src/http/agent-error-mapper';
import { BffHttpError } from '../../src/http/bff-http-error';

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

  it('returns a BFF-origin error unchanged instead of recategorizing it', () => {
    const local = new BffHttpError(422, 'relation_field_not_supported', 'nope', {
      fields: ['a:b'],
    });

    expect(mapAgentError(local, { logger })).toBe(local);
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

  it('ignores a non-error JSON:API status and keeps the enclosing error status', () => {
    const error = new AgentHttpError(
      404,
      jsonApiBody({ name: 'NotFoundError', status: 200, detail: 'gone' }),
    );

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({ type: 'not_found', status: 404 });
  });

  it('normalizes a wrapped-message JSON:API 5xx to agent_unavailable (503)', () => {
    const error = new Error(
      JSON.stringify(jsonApiBody({ name: 'InternalServerError', status: 503, detail: 'down' })),
    );

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({ type: 'agent_unavailable', status: 503 });
  });

  it('normalizes a 5xx JSON:API body inside an AgentHttpError whose outer status is not 5xx', () => {
    const error = new AgentHttpError(400, jsonApiBody({ name: 'X', status: 503, detail: 'down' }));

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({ type: 'agent_unavailable', status: 503 });
  });

  it('maps a transport failure to network_error (502) with a generic message and logs the cause', () => {
    const result = mapAgentError(new Error('connect ECONNREFUSED 10.0.4.23:8080'), { logger });

    expect(result).toMatchObject({
      type: 'network_error',
      status: 502,
      message: 'The agent could not be reached',
    });
    expect(result.message).not.toContain('10.0.4.23');
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      expect.any(String),
      expect.objectContaining({ cause: 'connect ECONNREFUSED 10.0.4.23:8080' }),
    );
  });

  it('maps valid JSON without an errors array to network_error and logs it', () => {
    const result = mapAgentError(new Error('{"foo":"bar"}'), { logger });

    expect(result).toMatchObject({ type: 'network_error', status: 502 });
    expect(logger).toHaveBeenCalledWith('Warn', expect.any(String), expect.anything());
  });

  it('falls back to the enclosing status when the JSON:API status is non-numeric', () => {
    const error = new AgentHttpError(
      404,
      jsonApiBody({ name: 'NotFoundError', status: 'abc', detail: 'x' }),
    );

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({ type: 'not_found', status: 404 });
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

  it('uses body.message when a flat body has no error field', () => {
    const result = mapAgentError(new AgentHttpError(400, { message: 'from message' }), { logger });

    expect(result).toMatchObject({ type: 'invalid_request', status: 400, message: 'from message' });
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

  it('maps an unmapped agent error name to the status-derived type (preserving status) and logs it', () => {
    const error = new AgentHttpError(
      400,
      jsonApiBody({
        name: 'MissingCollectionError',
        status: 400,
        detail: 'gone',
        data: { field: 'x' },
      }),
    );

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({
      type: 'invalid_request',
      status: 400,
      message: 'gone',
      details: { field: 'x' },
    });
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      expect.any(String),
      expect.objectContaining({ name: 'MissingCollectionError', status: 400 }),
    );
  });

  it('maps an unmapped agent error name with an unmapped status to invalid_request', () => {
    const error = new AgentHttpError(
      418,
      jsonApiBody({ name: 'TeapotError', status: 418, detail: 'nope' }),
    );

    const result = mapAgentError(error, { logger });

    expect(result).toMatchObject({ type: 'invalid_request', status: 418 });
  });
});
