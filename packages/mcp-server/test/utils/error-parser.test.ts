import { AgentHttpError } from '@forestadmin/agent-client';

import parseAgentError from '../../src/utils/error-parser';

describe('parseAgentError', () => {
  it('extracts the JSON:API detail from the parsed body', () => {
    const error = new AgentHttpError(400, {
      errors: [{ name: 'ValidationError', detail: 'Invalid filters provided' }],
    });

    expect(parseAgentError(error)).toBe('Invalid filters provided');
  });

  it('falls back to parsing responseText when the body is not a parsed object', () => {
    const error = new AgentHttpError(
      400,
      undefined,
      JSON.stringify({ errors: [{ detail: 'From raw text' }] }),
    );

    expect(parseAgentError(error)).toBe('From raw text');
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

  it('returns the message of a plain Error', () => {
    expect(parseAgentError(new Error('Plain error message'))).toBe('Plain error message');
  });

  it('returns null for an object without a message', () => {
    expect(parseAgentError({ unknownProperty: 'some value' })).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(parseAgentError(null)).toBeNull();
    expect(parseAgentError(undefined)).toBeNull();
  });
});
