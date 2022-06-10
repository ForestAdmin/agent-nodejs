import {
  ForbiddenError,
  UnprocessableError,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import Router from '@koa/router';

import * as factories from '../../__factories__';
import { HttpCode } from '../../../../src/agent/types';
import ErrorHandling from '../../../../src/agent/routes/system/error-handling';

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

  describe('with the route mounted in production mode', () => {
    const options = factories.forestAdminHttpDriverOptions.build({ isProduction: true });
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
      const next = jest.fn().mockRejectedValue(new ForbiddenError('forbiden'));

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.Forbidden);
      expect(context.response.body).toStrictEqual({ errors: [{ detail: 'forbiden' }] });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('it should set the status and body for UnprocessableError errors', async () => {
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
    });
  });
});
