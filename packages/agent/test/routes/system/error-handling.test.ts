import {
  ForbiddenError,
  UnprocessableError,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { createMockContext } from '@shopify/jest-koa-mocks';

import ErrorHandling from '../../../src/routes/system/error-handling';
import { AgentOptionsWithDefaults, HttpCode } from '../../../src/types';
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

  describe('with the route mounted and no custom message', () => {
    const options = factories.forestAdminHttpDriverOptions.build({
      customizeErrorMessage: error => (error.message === 'My Error' ? 'My Custom Error' : null),
      logger: jest.fn(),
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
      expect(options.logger).not.toHaveBeenCalled();
    });

    test('it should set the status and body for validation errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new ValidationError('hello'));

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.BadRequest);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'hello', name: 'ValidationError', status: 400 }],
      });
      expect(options.logger).not.toHaveBeenCalled();
    });

    test('it should set the status and body for forbidden errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new ForbiddenError('forbidden'));

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.Forbidden);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'forbidden', name: 'ForbiddenError', status: 403 }],
      });
      expect(options.logger).not.toHaveBeenCalled();
    });

    test('it should set the status and body for unprocessable errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new UnprocessableError('unprocessable'));

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.Unprocessable);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'unprocessable', name: 'UnprocessableError', status: 422 }],
      });
      expect(options.logger).not.toHaveBeenCalled();
    });

    test('it should set the status and body for other errors', async () => {
      const context = createMockContext();
      const next = jest.fn().mockRejectedValue(new Error('hello'));

      await handleError.call(route, context, next);

      expect(context.response.status).toStrictEqual(HttpCode.InternalServerError);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'Unexpected error', name: 'Error', status: 500 }],
      });
      expect(options.logger).not.toHaveBeenCalled();
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
      describe('whe the error is internal', () => {
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

      describe('whe the error is not internal', () => {
        test('it should not add anything to prevent information leak', async () => {
          const context = createMockContext();

          const fakeErrorFromDependency = new Error('message');
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          fakeErrorFromDependency.data = {
            property: 'value',
          };

          const next = jest.fn().mockRejectedValue(fakeErrorFromDependency);

          await handleError.call(route, context, next);

          expect(context.response.status).toStrictEqual(HttpCode.InternalServerError);
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

  describe('with the route mounted in a specific log level', () => {
    const makeContext = (loggerLevel: AgentOptionsWithDefaults['loggerLevel']) => {
      const options = factories.forestAdminHttpDriverOptions.build({
        loggerLevel,
        logger: jest.fn(),
      });

      let handleError: Router.Middleware;

      const route = new ErrorHandling(services, options);
      route.setupRoutes({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        use: (handler: Router.Middleware) => {
          handleError = handler;
        },
      });

      return { options, handleError, route };
    };

    const debugMessage = '===== An exception was raised =====';
    test.each([
      ['Debug', expect.stringContaining(debugMessage)],
      ['Error', expect.not.stringContaining(debugMessage)],
    ])('should print stuff to the logger', async (loggerLevel, expectToRun) => {
      const { handleError, route, options } = makeContext(
        loggerLevel as AgentOptionsWithDefaults['loggerLevel'],
      );
      const context = createMockContext({ method: 'POST' });
      const error = new Error('hello');
      const next = jest.fn().mockRejectedValue(error);

      await handleError.call(route, context, next);
      await new Promise(setImmediate);

      expect(options.logger).toHaveBeenCalledWith('Error', expectToRun, error, context);
      expect(context.response.status).toStrictEqual(HttpCode.InternalServerError);
      expect(context.response.body).toStrictEqual({
        errors: [{ detail: 'Unexpected error', name: 'Error', status: 500 }],
      });
    });
  });
});
