import type Router from '@koa/router';

import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableError,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import ErrorHandling from '../../../src/routes/system/error-handling';
import { HttpCode } from '../../../src/types';
import * as factories from '../../__factories__';

class FakePayloadError extends ForbiddenError {
  constructor(message: string) {
    super(message, {
      property: 'value',
    });
  }
}

describe('ErrorHandling', () => {
  const router = factories.router.mockAllMethods().build();
  const services = factories.forestAdminHttpDriverServices.build();

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockReturnValue();
  });

  test('should register a middleware', () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const route = new ErrorHandling(services, options);
    route.setupRoutes(router);

    expect(router.use).toHaveBeenCalledWith(expect.any(Function));
  });

  describe('with the route mounted in production mode, and no custom message', () => {
    const options = factories.forestAdminHttpDriverOptions.build({
      isProduction: true,
      customizeErrorMessage: error => (error.message === 'My Error' ? 'My Custom Error' : null),
    });

    let route: ErrorHandling;
    let handleError: Router.Middleware;

    beforeEach(() => {
      route = new ErrorHandling(services, options);
      route.setupRoutes({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        use: (handler: Router.Middleware) => {
          handleError = handler;
        },
      });
    });

    test('it should not touch the context when next() does not rejects', async () => {
      const context = {};
      const next = jest.fn().mockResolvedValue(undefined);

      await handleError.call(route, context, next);

      expect(context).toEqual({});
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for validation errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new ValidationError('hello'));

      await expect(handleError.call(route, context, next)).rejects.toThrow();

      expect(context.response.status).toStrictEqual(HttpCode.BadRequest);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'hello', name: 'ValidationError', status: 400 }],
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for bad request errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new BadRequestError('message'));

      await expect(handleError.call(route, context, next)).rejects.toThrow();

      expect(context.response.status).toStrictEqual(HttpCode.BadRequest);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'message', name: 'BadRequestError', status: 400 }],
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for unprocessable errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new UnprocessableError('message'));

      await expect(handleError.call(route, context, next)).rejects.toThrow();

      expect(context.response.status).toStrictEqual(HttpCode.Unprocessable);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'message', name: 'UnprocessableError', status: 422 }],
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for forbidden errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new ForbiddenError('forbidden'));

      await expect(handleError.call(route, context, next)).rejects.toThrow();

      expect(context.response.status).toStrictEqual(HttpCode.Forbidden);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'forbidden', name: 'ForbiddenError', status: 403 }],
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for not found errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new NotFoundError('message'));

      await expect(handleError.call(route, context, next)).rejects.toThrow();

      expect(context.response.status).toStrictEqual(HttpCode.NotFound);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'message', name: 'NotFoundError', status: 404 }],
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for unauthorized errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new UnauthorizedError('unauthorized'));

      await expect(handleError.call(route, context, next)).rejects.toThrow();

      expect(context.response.status).toStrictEqual(HttpCode.Unauthorized);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'unauthorized', name: 'UnauthorizedError', status: 401 }],
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for too many requests errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new TooManyRequestsError('rate limited'));

      await expect(handleError.call(route, context, next)).rejects.toThrow();

      expect(context.response.status).toStrictEqual(HttpCode.TooManyRequests);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'rate limited', name: 'TooManyRequestsError', status: 429 }],
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for other errors and prevent information leak', async () => {
      const context = createMockContext();
      const next = jest
        .fn()
        .mockRejectedValue(new Error('Internal error with important data that should not leak'));

      await expect(handleError.call(route, context, next)).rejects.toThrow();

      expect(context.response.status).toStrictEqual(HttpCode.InternalServerError);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'Unexpected error', name: 'Error', status: 500 }],
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should send the customized error message to the frontend', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new Error('My Error'));

      await expect(handleError.call(route, context, next)).rejects.toThrow();

      expect(context.response.status).toStrictEqual(HttpCode.InternalServerError);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'My Custom Error', name: 'Error', status: 500 }],
      });
    });

    describe('with an error that supports data (payload)', () => {
      describe('whe the error is internal', () => {
        test('it should add data to the body', async () => {
          const context = createMockContext();
          const next = jest.fn().mockRejectedValue(new FakePayloadError('message'));

          await expect(handleError.call(route, context, next)).rejects.toThrow();

          expect(context.response.status).toStrictEqual(HttpCode.Forbidden);
          expect(context.response.body).toStrictEqual({
            errors: [
              {
                detail: 'message',
                name: 'FakePayloadError',
                status: 403,
                data: {
                  property: 'value',
                },
              },
            ],
          });
        });
      });

      describe('whe the error is not internal', () => {
        test('it should not add anything to prevent information leak', async () => {
          const context = createMockContext();

          const fakeErrorFromDependency = new Error('a custom message');
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          fakeErrorFromDependency.data = {
            property: 'value',
          };

          const next = jest.fn().mockRejectedValue(fakeErrorFromDependency);

          await expect(handleError.call(route, context, next)).rejects.toThrow();

          expect(context.response.status).toStrictEqual(HttpCode.InternalServerError);
          expect(context.response.body).toStrictEqual({
            errors: [
              {
                detail: 'Unexpected error',
                name: 'Error',
                status: 500,
              },
            ],
          });
        });
      });
    });
  });

  describe('with the route mounted in dev mode', () => {
    const options = factories.forestAdminHttpDriverOptions.build({ isProduction: false });
    let route: ErrorHandling;
    let handleError: Router.Middleware;

    beforeEach(() => {
      route = new ErrorHandling(services, options);
      route.setupRoutes({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        use: (handler: Router.Middleware) => {
          handleError = handler;
        },
      });
    });

    test('it should print stuff to stderr', async () => {
      const context = createMockContext({ method: 'POST' });
      const next = jest.fn().mockRejectedValue(new Error('Internal error'));

      await expect(handleError.call(route, context, next)).rejects.toThrow();

      await new Promise(setImmediate);

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('guaranty cross packages instanceof errors workaround', () => {
    describe('when using extended errors', () => {
      test('it should be detected correctly', async () => {
        const extendedError = new FakePayloadError('message');

        expect(extendedError.baseBusinessErrorName).toStrictEqual('ForbiddenError');
        expect(extendedError.isBusinessError).toBeTrue();
      });
    });

    test.each([
      { Error: ValidationError, errorName: 'ValidationError' },
      { Error: BadRequestError, errorName: 'BadRequestError' },
      { Error: UnprocessableError, errorName: 'UnprocessableError' },
      { Error: ForbiddenError, errorName: 'ForbiddenError' },
      { Error: NotFoundError, errorName: 'NotFoundError' },
      { Error: UnauthorizedError, errorName: 'UnauthorizedError' },
      { Error: TooManyRequestsError, errorName: 'TooManyRequestsError' },
    ])('should have the right baseBusinessErrorName', ({ Error, errorName }) => {
      const extendedError = new Error('message');

      expect(extendedError.baseBusinessErrorName).toStrictEqual(errorName);
      expect(extendedError.isBusinessError).toBeTrue();
    });
  });
});
