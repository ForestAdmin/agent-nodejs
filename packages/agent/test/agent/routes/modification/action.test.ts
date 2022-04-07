import {
  ActionFieldType,
  ActionResult,
  ActionResultType,
  ActionScope,
  DataSource,
  Filter,
  Operator,
} from '@forestadmin/datasource-toolkit';
import { Readable } from 'stream';
import { createMockContext } from '@shopify/jest-koa-mocks';
import Router from '@koa/router';

import * as factories from '../../__factories__';
import ActionRoute from '../../../../src/agent/routes/modification/action';

describe('ActionRoute', () => {
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
        getForm: jest.fn().mockResolvedValue([
          {
            type: ActionFieldType.String,
            label: 'a field',
            watchChanges: false,
          },
        ]),
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
    let dataSource: DataSource;
    let route: ActionRoute;
    let handleExecute: Router.Middleware;
    let handleHook: Router.Middleware;

    const baseContext = {
      customProperties: {
        query: { timezone: 'Europe/Paris' },
      },
      requestBody: {
        data: {
          attributes: {
            ids: ['123e4567-e89b-12d3-a456-426614174000'],
            all_records: false,
            all_records_ids_excluded: [],
          },
        },
      },
    };

    beforeEach(() => {
      dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: {
            actions: { My_Action: { scope: ActionScope.Single } },
            fields: { id: factories.columnSchema.isPrimaryKey().build() },
          },
          getForm: jest
            .fn()
            .mockResolvedValue([{ type: ActionFieldType.String, label: 'firstname' }]),
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

    test('handleExecute should check permissions', async () => {
      const context = createMockContext({
        ...baseContext,
        requestBody: {
          data: {
            attributes: {
              ...baseContext.requestBody.data.attributes,
              values: { firstname: 'John' },
            },
          },
        },
      });

      (dataSource.getCollection('books').execute as jest.Mock).mockResolvedValue({
        type: ActionResultType.Error,
        message: 'the result does not matter',
      });

      await handleExecute.call(route, context);

      expect(services.permissions.can).toHaveBeenCalledWith(context, 'custom:My_Action:books');
    });

    test('handleExecute should delegate to collection with good params', async () => {
      const context = createMockContext({
        ...baseContext,
        requestBody: {
          data: {
            attributes: {
              ...baseContext.requestBody.data.attributes,
              values: { firstname: 'John' },
            },
          },
        },
      });

      (dataSource.getCollection('books').execute as jest.Mock).mockResolvedValue({
        type: ActionResultType.Error,
        message: 'the result does not matter',
      });

      await handleExecute.call(route, context);

      expect(dataSource.getCollection('books').execute).toHaveBeenCalledWith(
        'My_Action',
        { firstname: 'John' },
        {
          conditionTree: {
            field: 'id',
            operator: 'equal',
            value: '123e4567-e89b-12d3-a456-426614174000',
          },
          search: null,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        },
      );
    });

    test.each([
      [
        'Success (text)',
        {
          type: ActionResultType.Success,
          message: 'it went great!',
          format: 'text',
          invalidated: new Set(),
        },
        { success: 'it went great!', refresh: { relationships: [] } },
      ],
      [
        'Success (html)',
        {
          type: ActionResultType.Success,
          message: 'it went great!',
          format: 'html',
          invalidated: new Set(),
        },
        { html: 'it went great!', refresh: { relationships: [] } },
      ],
      [
        'Error',
        { type: ActionResultType.Error, message: 'it went very badly!' },
        { error: 'it went very badly!' },
      ],
      [
        'Webhook',
        {
          type: ActionResultType.Webhook,
          url: 'google.com',
          method: 'POST',
          headers: {},
          body: {},
        },
        {
          webhook: { url: 'google.com', method: 'POST', headers: {}, body: {} },
        },
      ],
      [
        'Redirect',
        { type: ActionResultType.Redirect, path: '/route-that-the-frontend-should-go-to' },
        { redirectTo: '/route-that-the-frontend-should-go-to' },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as Array<[string, ActionResult, any]>)(
      'handleExecute should format the response (%s)',
      async (_, executeResult, expectedBody) => {
        const context = createMockContext({
          ...baseContext,
          requestBody: {
            data: {
              attributes: {
                ...baseContext.requestBody.data.attributes,
                values: { firstname: 'John' },
              },
            },
          },
        });

        (dataSource.getCollection('books').execute as jest.Mock).mockResolvedValue(executeResult);
        await handleExecute.call(route, context);
        expect(context.response.body).toEqual(expectedBody);
      },
    );

    describe('handleExecute', () => {
      test('should format the response (File)', async () => {
        const context = createMockContext({
          ...baseContext,
          requestBody: {
            data: {
              attributes: {
                ...baseContext.requestBody.data.attributes,
                values: { firstname: 'John' },
              },
            },
          },
        });
        const stream = Readable.from(['header1,header2mcontent1,content2']);

        (dataSource.getCollection('books').execute as jest.Mock).mockResolvedValue({
          type: ActionResultType.File,
          name: 'filename.csv',
          mimeType: 'text/csv',
          stream,
        });

        await handleExecute.call(route, context);

        expect(context.response.headers).toEqual({
          'access-control-expose-headers': 'Content-Disposition',
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="filename.csv"',
        });
        expect(context.response.body).toBe(stream);
      });

      describe('when action is applied on the related data with a selected all', () => {
        beforeEach(() => {
          dataSource = factories.dataSource.buildWithCollections([
            factories.collection.build({
              name: 'reviews',
              schema: {
                actions: { My_Action: { scope: ActionScope.Bulk } },
                fields: { id: factories.columnSchema.isPrimaryKey().build() },
              },
              getForm: jest
                .fn()
                .mockResolvedValue([{ type: ActionFieldType.String, label: 'firstname' }]),
              execute: jest.fn(),
            }),
            factories.collection.build({
              name: 'books',
              schema: {
                fields: {
                  id: factories.columnSchema.isPrimaryKey().build(),
                  reviews: factories.oneToManySchema.build({
                    foreignCollection: 'reviews',
                  }),
                },
              },
              getForm: jest
                .fn()
                .mockResolvedValue([{ type: ActionFieldType.String, label: 'firstname' }]),
              execute: jest.fn(),
            }),
          ]);

          route = new ActionRoute(services, options, dataSource, 'reviews', 'My_Action');

          route.setupRoutes({
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            post: (path: string, handler: Router.Middleware) => {
              if (path === '/_actions/reviews/0/:slug') handleExecute = handler;
              else handleHook = handler;
            },
          });
        });

        test('should apply the handler only on the related data', async () => {
          const context = createMockContext({
            ...baseContext,
            requestBody: {
              data: {
                attributes: {
                  ...baseContext.requestBody.data.attributes,
                  parent_association_name: 'reviews',
                  parent_collection_name: 'books',
                  parent_collection_id: '00000000-0000-4000-8000-000000000000',
                  all_records: true,
                  values: { firstname: 'John' },
                },
              },
            },
          });
          dataSource.getCollection('reviews').execute = jest.fn().mockReturnValue({
            type: ActionResultType.Webhook,
          });

          await handleExecute.call(route, context);

          expect(dataSource.getCollection('reviews').execute).toHaveBeenCalledWith(
            'My_Action',
            expect.any(Object),
            new Filter({
              conditionTree: factories.conditionTreeLeaf.build({
                field: 'reviewId',
                operator: Operator.Equal,
                value: '00000000-0000-4000-8000-000000000000',
              }),
              search: null,
              searchExtended: false,
              segment: null,
              timezone: 'Europe/Paris',
            }),
          );
        });
      });

      test('should crash if the response is invalid', async () => {
        const context = createMockContext({
          ...baseContext,
          requestBody: {
            data: {
              attributes: {
                ...baseContext.requestBody.data.attributes,
                values: { firstname: 'John' },
              },
            },
          },
        });

        (dataSource.getCollection('books').execute as jest.Mock).mockResolvedValue({
          type: 'invalid',
        });

        await expect(() => handleExecute.call(route, context)).rejects.toThrow();
      });
    });

    test('handleHook should generate a clean form if called without params', async () => {
      const context = createMockContext(baseContext);
      await handleHook.call(route, context);

      expect(dataSource.getCollection('books').getForm).toHaveBeenCalledWith('My_Action', null, {
        conditionTree: {
          field: 'id',
          operator: 'equal',
          value: '123e4567-e89b-12d3-a456-426614174000',
        },
        search: null,
        searchExtended: false,
        segment: null,
        timezone: 'Europe/Paris',
      });

      expect(context.response.body).toEqual({ fields: [{ field: 'firstname', type: 'String' }] });
    });

    test('handleHook should generate the form if called with changehook params', async () => {
      const context = createMockContext({
        ...baseContext,
        requestBody: {
          data: {
            attributes: {
              ...baseContext.requestBody.data.attributes,
              fields: [{ field: 'firstname', value: 'John' }],
            },
          },
        },
      });

      await handleHook.call(route, context);

      expect(dataSource.getCollection('books').getForm).toHaveBeenCalledWith(
        'My_Action',
        { firstname: 'John' },
        {
          conditionTree: {
            field: 'id',
            operator: 'equal',
            value: '123e4567-e89b-12d3-a456-426614174000',
          },
          search: null,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        },
      );

      expect(context.response.body).toEqual({ fields: [{ field: 'firstname', type: 'String' }] });
    });
  });
});
