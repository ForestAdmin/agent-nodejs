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
      expect(context.response.body).toStrictEqual({ errors: [{ detail: 'hello' }] });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for forbidden errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new ForbiddenError('forbidden'));

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.Forbidden);
      expect(context.response.body).toStrictEqual({ errors: [{ detail: 'forbidden' }] });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for unprocessable errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new UnprocessableError('unprocessable'));

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.Unprocessable);
      expect(context.response.body).toStrictEqual({ errors: [{ detail: 'unprocessable' }] });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for other errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new Error('hello'));

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.InternalServerError);
      expect(context.response.body).toStrictEqual({ errors: [{ detail: 'Unexpected error' }] });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should send the customized error message to the frontend', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new Error('My Error'));

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.InternalServerError);
      expect(context.response.body).toStrictEqual({ errors: [{ detail: 'My Custom Error' }] });
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
      expect(context.response.body).toStrictEqual({ errors: [{ detail: 'Unexpected error' }] });
    });
  });
});
