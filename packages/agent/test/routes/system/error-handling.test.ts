import {
  ForbiddenError,
  UnprocessableError,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { createMockContext } from '@shopify/jest-koa-mocks';

import ErrorHandling from '../../../src/routes/system/error-handling';
import { HttpCode } from '../../../src/types';
import * as factories from '../../__factories__';

class FakePayloadError extends ForbiddenError {
  private readonly data: { property: string };

  constructor(...args) {
    super(...args);

    this.data = {
      property: 'value',
    };
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

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.BadRequest);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'hello', name: 'ValidationError', status: 400 }],
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for forbidden errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new ForbiddenError('forbidden'));

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.Forbidden);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'forbidden', name: 'ForbiddenError', status: 403 }],
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for unprocessable errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new UnprocessableError('unprocessable'));

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.Unprocessable);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'unprocessable', name: 'UnprocessableError', status: 422 }],
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for other errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new Error('hello'));

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.InternalServerError);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'Unexpected error', name: 'Error', status: 500 }],
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should send the customized error message to the frontend', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new Error('My Error'));

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.InternalServerError);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'My Custom Error', name: 'Error', status: 500 }],
      });
    });

    describe('with an error that supports data (payload)', () => {
      test('it should add data to the body', async () => {
        const context = createMockContext();
        const next = jest.fn().mockRejectedValue(new FakePayloadError('message'));

        await handleError.call(route, context, next);

        expect(context.response.status).toStrictEqual(HttpCode.Forbidden);
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
      const next = jest.fn().mockRejectedValue(new Error('hello'));

      await handleError.call(route, context, next);
      await new Promise(setImmediate);

      expect(console.error).toHaveBeenCalled();
      expect(context.response.status).toStrictEqual(HttpCode.InternalServerError);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'Unexpected error', name: 'Error', status: 500 }],
      });
    });
  });
});
