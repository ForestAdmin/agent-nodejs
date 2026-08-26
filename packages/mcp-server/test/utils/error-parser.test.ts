import { AgentHttpError } from '@forestadmin/agent-client';

import parseAgentError from '../../src/utils/error-parser';

describe('parseAgentError', () => {
  it('appends the HTTP status to the JSON:API detail from the parsed body', () => {
    const error = new AgentHttpError(400, {
      errors: [{ name: 'ValidationError', detail: 'Invalid filters provided' }],
    });

    expect(parseAgentError(error)).toBe('Invalid filters provided (HTTP 400)');
  });

  it('appends the HTTP status to the JSON:API detail parsed from responseText', () => {
    const error = new AgentHttpError(
      400,
      undefined,
      JSON.stringify({ errors: [{ detail: 'From raw text' }] }),
    );

    expect(parseAgentError(error)).toBe('From raw text (HTTP 400)');
  });

  it('returns the generic HTTP message when the body has no JSON:API detail', () => {
    expect(parseAgentError(new AgentHttpError(400, { success: false }))).toBe(
      'Agent responded with HTTP 400',
    );
  });

  it('returns the generic HTTP message for an empty errors array', () => {
    expect(parseAgentError(new AgentHttpError(422, { errors: [] }))).toBe(
      'Agent responded with HTTP 422',
    );
  });

  it('does not append a second HTTP status when the body is not JSON:API', () => {
    expect(parseAgentError(new AgentHttpError(500, '<html>Internal Server Error</html>'))).toBe(
      'Agent responded with HTTP 500',
    );
  });

  it('returns the message of a plain Error', () => {
    expect(parseAgentError(new Error('Plain error message'))).toBe('Plain error message');
  });

  it('returns null for an object without a message', () => {
    expect(parseAgentError({ unknownProperty: 'some value' })).toBeNull();
  });

  it('appends the cause detail of a wrapper error (e.g. ApprovalRequestCreationError)', () => {
    const error = new Error(
      'The action requires an approval, but the approval request could not be created.',
    ) as Error & { cause: unknown };
    error.cause = new AgentHttpError(422, {
      errors: [
        { detail: 'Approval requests are limited to 500 records; please narrow your selection' },
      ],
    });

    expect(parseAgentError(error)).toBe(
      'The action requires an approval, but the approval request could not be created. ' +
        'Approval requests are limited to 500 records; please narrow your selection (HTTP 422)',
    );
  });

  it('ignores a cause without extractable detail', () => {
    const error = new Error('Wrapper message') as Error & { cause: unknown };
    error.cause = { foo: 'bar' };

    expect(parseAgentError(error)).toBe('Wrapper message');
  });

  it('does not recurse forever on a cyclic cause chain', () => {
    const error = new Error('Cyclic') as Error & { cause: unknown };
    error.cause = error;

    expect(parseAgentError(error)).toBe('Cyclic Cyclic Cyclic Cyclic');
  });

  it('returns null for null/undefined', () => {
    expect(parseAgentError(null)).toBeNull();
    expect(parseAgentError(undefined)).toBeNull();
  });
});
