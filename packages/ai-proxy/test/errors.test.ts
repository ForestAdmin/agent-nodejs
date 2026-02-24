import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';

import {
  AIBadRequestError,
  AIForbiddenError,
  AIModelNotSupportedError,
  AINotConfiguredError,
  AINotFoundError,
  AIProviderError,
  AITooManyRequestsError,
  AIUnauthorizedError,
  AIToolNotFoundError,
  AIToolUnprocessableError,
  McpConfigError,
  McpConflictError,
  McpConnectionError,
  McpError,
} from '../src/errors';

describe('AI Error Hierarchy', () => {
  describe('UnprocessableError branch (422)', () => {
    test('AINotConfiguredError extends UnprocessableError', () => {
      const error = new AINotConfiguredError();
      expect(error).toBeInstanceOf(UnprocessableError);
    });

    test('AIToolUnprocessableError extends UnprocessableError', () => {
      const error = new AIToolUnprocessableError('test');
      expect(error).toBeInstanceOf(UnprocessableError);
    });

    test('AIProviderError extends UnprocessableError', () => {
      const error = new AIProviderError('OpenAI', { cause: new Error('test') });
      expect(error).toBeInstanceOf(UnprocessableError);
      expect(error.provider).toBe('OpenAI');
    });

    test('McpError extends UnprocessableError', () => {
      const error = new McpError('test');
      expect(error).toBeInstanceOf(UnprocessableError);
    });

    test('McpConnectionError extends UnprocessableError via McpError', () => {
      const error = new McpConnectionError('test');
      expect(error).toBeInstanceOf(McpError);
      expect(error).toBeInstanceOf(UnprocessableError);
    });

    test('McpConflictError extends UnprocessableError via McpError', () => {
      const error = new McpConflictError('entity');
      expect(error).toBeInstanceOf(McpError);
      expect(error).toBeInstanceOf(UnprocessableError);
    });

    test('McpConfigError extends UnprocessableError via McpError', () => {
      const error = new McpConfigError('test');
      expect(error).toBeInstanceOf(McpError);
      expect(error).toBeInstanceOf(UnprocessableError);
    });
  });

  describe('TooManyRequestsError branch (429)', () => {
    test('AITooManyRequestsError extends TooManyRequestsError', () => {
      const error = new AITooManyRequestsError('OpenAI');
      expect(error).toBeInstanceOf(TooManyRequestsError);
      expect(error.provider).toBe('OpenAI');
    });
  });

  describe('UnauthorizedError branch (401)', () => {
    test('AIUnauthorizedError extends UnauthorizedError', () => {
      const error = new AIUnauthorizedError('OpenAI');
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.provider).toBe('OpenAI');
    });
  });

  describe('ForbiddenError branch (403)', () => {
    test('AIForbiddenError extends ForbiddenError', () => {
      const error = new AIForbiddenError('OpenAI', { cause: new Error('model access denied') });
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.provider).toBe('OpenAI');
      expect(error.message).toBe('OpenAI access denied: model access denied');
    });
  });

  describe('BadRequestError branch (400)', () => {
    test('AIBadRequestError extends BadRequestError', () => {
      const error = new AIBadRequestError('test');
      expect(error).toBeInstanceOf(BadRequestError);
    });

    test('AIModelNotSupportedError extends BadRequestError via AIBadRequestError', () => {
      const error = new AIModelNotSupportedError('gpt-4');
      expect(error).toBeInstanceOf(AIBadRequestError);
      expect(error).toBeInstanceOf(BadRequestError);
    });
  });

  describe('NotFoundError branch (404)', () => {
    test('AINotFoundError extends NotFoundError', () => {
      const error = new AINotFoundError('test');
      expect(error).toBeInstanceOf(NotFoundError);
    });

    test('AIToolNotFoundError extends NotFoundError via AINotFoundError', () => {
      const error = new AIToolNotFoundError('test');
      expect(error).toBeInstanceOf(AINotFoundError);
      expect(error).toBeInstanceOf(NotFoundError);
    });
  });
});
