import { ActionScope } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import Router from '@koa/router';

import * as factories from '../../__factories__';
import ActionRoute from '../../../src/routes/modification/action';

describe('ScopeInvalidation', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();
  const services = factories.forestAdminHttpDriverServices.build();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('should register three routes', () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: { actions: { My_Action: {} } },
        getForm: jest.fn(),
        execute: jest.fn(),
      }),
    ]);

    const route = new ActionRoute(services, options, dataSource, 'books', 'My_Action');
    route.setupRoutes(router);

    expect(router.post).toHaveBeenCalledWith('/_actions/books/0/:slug', expect.any(Function));
    expect(router.post).toHaveBeenCalledWith(
      '/_actions/books/0/:slug/hooks/load',
      expect.any(Function),
    );
    expect(router.post).toHaveBeenCalledWith(
      '/_actions/books/0/:slug/hooks/change',
      expect.any(Function),
    );
  });

  describe('with the route mounted', () => {
    let route: ActionRoute;
    let handleExecute: Router.Middleware;
    let handleHook: Router.Middleware;

    beforeEach(() => {
      const dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: { actions: { My_Action: {} } },
          getForm: jest.fn(),
          execute: jest.fn(),
        }),
      ]);

      route = new ActionRoute(services, options, dataSource, 'books', 'My_Action');
      route.setupRoutes({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        post: (path: string, handler: Router.Middleware) => {
          if (path === '/_actions/books/0/:slug') handleExecute = handler;
          else handleHook = handler;
        },
      });
    });

    test('should throw if body is not provided', async () => {});
  });
});
