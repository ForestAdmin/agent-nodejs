import {
  BadRequestError,
  NotFoundError,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';

import {
  AIBadRequestError,
  AIError,
  AIModelNotSupportedError,
  AINotConfiguredError,
  AINotFoundError,
  AIToolNotFoundError,
  AIToolUnprocessableError,
  AIUnprocessableError,
  McpConfigError,
  McpConflictError,
  McpConnectionError,
  McpError,
} from '../src/errors';

describe('AI Error Hierarchy', () => {
  describe('UnprocessableError branch (422)', () => {
    test('AIError extends UnprocessableError', () => {
      const error = new AIError('test');
      expect(error).toBeInstanceOf(UnprocessableError);
    });

    test('AINotConfiguredError extends UnprocessableError via AIError', () => {
      const error = new AINotConfiguredError();
      expect(error).toBeInstanceOf(AIError);
      expect(error).toBeInstanceOf(UnprocessableError);
    });

    test('McpError extends UnprocessableError via AIError', () => {
      const error = new McpError('test');
      expect(error).toBeInstanceOf(AIError);
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

    test('AIUnprocessableError extends UnprocessableError', () => {
      const error = new AIUnprocessableError('test');
      expect(error).toBeInstanceOf(UnprocessableError);
    });

    test('AIToolUnprocessableError extends UnprocessableError via AIUnprocessableError', () => {
      const error = new AIToolUnprocessableError('test');
      expect(error).toBeInstanceOf(AIUnprocessableError);
      expect(error).toBeInstanceOf(UnprocessableError);
      expect(error.name).toBe('AIToolUnprocessableError');
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
