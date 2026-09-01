import type { WorkflowExecutorError } from '../src/errors';

import {
  ActionFormValidationError,
  ActionNotFoundError,
  ActionRequiresApprovalError,
  AgentPortError,
  AiModelPortError,
  FieldNotFoundError,
  FieldTypeMissingError,
  InvalidAiRequestError,
  InvalidPendingDataError,
  InvalidPreRecordedArgsError,
  MissingToolCallError,
  NoActionsError,
  NoMcpToolsError,
  NoReadableFieldsError,
  NoRecordsError,
  NoRelationshipFieldsError,
  NoWritableFieldsError,
  OAuthInvalidGrantError,
  OAuthReauthRequiredError,
  OAuthRefreshError,
  PendingDataNotFoundError,
  PinnedArgNotFoundError,
  RecordNotFoundError,
  RelatedRecordNotFoundError,
  RelationNotFoundError,
  SourceRecordMissingError,
  StepStateError,
  StepTimeoutError,
  causeMessage,
  extractErrorMessage,
} from '../src/errors';

describe('extractErrorMessage', () => {
  it('returns err.message when non-empty', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('falls back to err.parent.message when err.message is empty (Sequelize pattern)', () => {
    const err = new Error('');
    (err as Error & { parent?: Error }).parent = new Error('connect ECONNREFUSED 127.0.0.1:5459');

    expect(extractErrorMessage(err)).toBe('connect ECONNREFUSED 127.0.0.1:5459');
  });

  it('falls back to err.cause.message when err.message is empty (Error.cause pattern)', () => {
    const err = new Error('');
    (err as Error & { cause?: Error }).cause = new Error('downstream failed');

    expect(extractErrorMessage(err)).toBe('downstream failed');
  });

  it('prefers err.parent over err.cause when both are set', () => {
    const err = new Error('');
    (err as Error & { cause?: Error }).cause = new Error('from cause');
    (err as Error & { parent?: Error }).parent = new Error('from parent');

    expect(extractErrorMessage(err)).toBe('from parent');
  });

  it('falls back to err.name when message/parent/cause are absent', () => {
    class MyError extends Error {
      override name = 'MyError';
    }

    expect(extractErrorMessage(new MyError(''))).toBe('MyError');
  });

  it('returns "Unknown error" when a custom Error overrides .name to empty string', () => {
    const err = new Error('');
    // Force-empty name to exercise the final fallback branch
    Object.defineProperty(err, 'name', { value: '' });

    expect(extractErrorMessage(err)).toBe('Unknown error');
  });

  it('converts non-Error values to string', () => {
    expect(extractErrorMessage('plain string')).toBe('plain string');
    expect(extractErrorMessage(42)).toBe('42');
    expect(extractErrorMessage(null)).toBe('null');
  });

  it('returns undefined when called with undefined', () => {
    expect(extractErrorMessage(undefined)).toBeUndefined();
    expect(extractErrorMessage()).toBeUndefined();
  });

  it('ignores a non-Error .parent (Sequelize-like shape but wrong type)', () => {
    const err = new Error('');
    (err as Error & { parent?: unknown }).parent = 'not an error';
    (err as Error & { cause?: unknown }).cause = new Error('from cause');

    expect(extractErrorMessage(err)).toBe('from cause');
  });
});

describe('causeMessage', () => {
  it('returns the cause message when the error has an Error cause', () => {
    const err = new Error('outer');
    (err as Error & { cause?: unknown }).cause = new Error('inner');

    expect(causeMessage(err)).toBe('inner');
  });

  it('returns undefined for a rejection with no usable cause', () => {
    expect(causeMessage(new Error('no cause'))).toBeUndefined();
    expect(causeMessage('a string')).toBeUndefined();
  });

  // Callers log from catch handlers, several of which cannot themselves throw — a rejection value
  // of null or undefined must not turn a log line into a second failure.
  it('returns undefined for null and undefined', () => {
    expect(causeMessage(null)).toBeUndefined();
    expect(causeMessage(undefined)).toBeUndefined();
  });
});

describe('NoMcpToolsError', () => {
  it('includes the requested mcpServerId in the technical message', () => {
    const err = new NoMcpToolsError('id-missing');

    expect(err.message).toBe('No MCP tools available for mcpServerId="id-missing"');
  });

  it('keeps the user-facing message free of internal ids', () => {
    const err = new NoMcpToolsError('id-missing');

    expect(err.userMessage).toMatch(/^Tools could not be loaded for the targeted server\./);
    expect(err.userMessage).not.toMatch(/id-missing/);
  });
});

describe('AiModelPortError', () => {
  it('includes the operation and Error cause message in the technical message', () => {
    const err = new AiModelPortError('invoke', new Error('timeout'));

    expect(err.message).toMatch(/invoke/);
    expect(err.message).toMatch(/timeout/);
  });

  it('converts non-Error causes to string in the technical message', () => {
    const err = new AiModelPortError('invoke', 'network failure');

    expect(err.message).toMatch(/network failure/);
  });

  it('exposes a generic user-facing message', () => {
    const err = new AiModelPortError('invoke', new Error('timeout'));

    expect(err.userMessage).toBe(
      'The AI service is unavailable. Please try again or contact your administrator.',
    );
  });

  it('stores the original cause', () => {
    const cause = new Error('root cause');
    const err = new AiModelPortError('invoke', cause);

    expect(err.cause).toBe(cause);
  });
});

describe('PendingDataNotFoundError', () => {
  it('includes the runId and stepIndex in the message', () => {
    const err = new PendingDataNotFoundError('run-42', 3);

    expect(err.message).toMatch(/run-42/);
    expect(err.message).toMatch(/3/);
  });

  it('sets name to PendingDataNotFoundError', () => {
    const err = new PendingDataNotFoundError('run-1', 0);

    expect(err.name).toBe('PendingDataNotFoundError');
  });
});

describe('InvalidPendingDataError', () => {
  it('stores the provided validation issues', () => {
    const issues = [{ path: ['field'], message: 'required', code: 'invalid_type' }];
    const err = new InvalidPendingDataError(issues);

    expect(err.issues).toBe(issues);
  });

  it('exposes a generic user-facing message', () => {
    const err = new InvalidPendingDataError([]);

    expect(err.userMessage).toBe('The request body is invalid.');
  });
});

describe('OAuthReauthRequiredError', () => {
  it("defaults awaitingInputReason to 'needs-oauth-reauth' and names the server in the technical message", () => {
    const err = new OAuthReauthRequiredError('srv-1');

    expect(err.awaitingInputReason).toBe('needs-oauth-reauth');
    expect(err.message).toMatch(/srv-1/);
  });

  it('keeps the user-facing message free of the internal server id', () => {
    const err = new OAuthReauthRequiredError('srv-1');

    expect(err.userMessage).not.toMatch(/srv-1/);
  });
});

describe('OAuthRefreshError', () => {
  it('prefixes the technical message and stores the cause', () => {
    const cause = new Error('5xx');
    const err = new OAuthRefreshError('endpoint unreachable', cause);

    expect(err.message).toMatch(/endpoint unreachable/);
    expect(err.cause).toBe(cause);
  });
});

describe('OAuthInvalidGrantError', () => {
  it('includes the detail when provided', () => {
    expect(new OAuthInvalidGrantError('token expired').message).toMatch(/token expired/);
  });
});

describe('errorKind classification', () => {
  // The record or the submitted input is the problem — nothing is broken in the workflow or the agent.
  it.each<[string, WorkflowExecutorError]>([
    ['NoRecordsError', new NoRecordsError()],
    ['RecordNotFoundError', new RecordNotFoundError('customers', [42])],
    ['RelatedRecordNotFoundError', new RelatedRecordNotFoundError('customers', 'orders')],
    ['ActionFormValidationError', new ActionFormValidationError('send-welcome-email')],
    ['ActionRequiresApprovalError', new ActionRequiresApprovalError('send-welcome-email')],
  ])('classifies %s as operator', (_, error) => {
    expect(error.errorKind).toBe('operator');
  });

  // The step cannot succeed as configured, whatever the run does. Every member's own userMessage
  // already says so; the kind only makes it machine-readable.
  it.each<[string, WorkflowExecutorError]>([
    ['FieldNotFoundError', new FieldNotFoundError('emailz', 'customers')],
    ['PinnedArgNotFoundError (field)', new PinnedArgNotFoundError('field', 'total', 'orders')],
    ['PinnedArgNotFoundError (action)', new PinnedArgNotFoundError('action', 'refund', 'orders')],
    ['ActionNotFoundError', new ActionNotFoundError('sned-email', 'customers')],
    ['RelationNotFoundError', new RelationNotFoundError('orderz', 'customers')],
    ['NoActionsError', new NoActionsError('customers')],
    ['NoWritableFieldsError', new NoWritableFieldsError('customers')],
    ['NoReadableFieldsError', new NoReadableFieldsError('customers')],
    ['NoRelationshipFieldsError', new NoRelationshipFieldsError('customers')],
    ['FieldTypeMissingError', new FieldTypeMissingError('status', 'customers')],
    ['InvalidAiRequestError', new InvalidAiRequestError('SystemMessage at position 3')],
    ['InvalidPreRecordedArgsError', new InvalidPreRecordedArgsError('no record at step index 4')],
  ])('classifies %s as configuration', (_, error) => {
    expect(error.errorKind).toBe('configuration');
  });

  // Unclassified is the starting default: an error nobody has triaged keeps today's framing.
  it.each<[string, WorkflowExecutorError]>([
    ['StepTimeoutError', new StepTimeoutError(30)],
    ['AgentPortError', new AgentPortError('getRecord', new Error('ECONNREFUSED'))],
    ['AiModelPortError', new AiModelPortError('invoke', new Error('timeout'))],
    ['MissingToolCallError', new MissingToolCallError()],
    ['StepStateError', new StepStateError('Step at index 0 has no pending data')],
  ])('leaves %s unclassified', (_, error) => {
    expect(error.errorKind).toBeUndefined();
  });

  describe('SourceRecordMissingError', () => {
    it('is unclassified and names no source step by default', () => {
      const error = new SourceRecordMissingError('Load the order');

      expect(error.errorKind).toBeUndefined();
      expect(error.errorSourceStepIndex).toBeUndefined();
    });

    // The only error whose kind depends on why it was thrown: the throw site is the one place that
    // knows whether a candidate was offered.
    it.each(['operator', 'configuration'] as const)(
      'takes the %s kind from the throw site',
      kind => {
        const error = new SourceRecordMissingError('Load the order', { errorKind: kind });

        expect(error.errorKind).toBe(kind);
        expect(error.userMessage).toContain("didn't load any record");
      },
    );

    it('carries the index of the source step the guard resolved', () => {
      const error = new SourceRecordMissingError('Load the order', {
        errorKind: 'operator',
        errorSourceStepIndex: 4,
      });

      expect(error.errorSourceStepIndex).toBe(4);
    });
  });
});
