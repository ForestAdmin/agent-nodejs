import {
  ActionResult,
  DataSource,
  Filter,
  ForbiddenError,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import { Readable } from 'stream';

import ActionRoute from '../../../../src/routes/modification/action/action';
import CustomActionTriggerForbiddenError from '../../../../src/routes/modification/action/errors/custom-action-trigger-forbidden-error';
import * as factories from '../../../__factories__';

// This part of the context is the same in all tests.
const baseContext = {
  state: { user: { id: '42', email: 'john.doe@domain.com' } },
  customProperties: { query: { email: 'john.doe@domain.com', timezone: 'Europe/Paris' } },
  requestBody: {
    data: {
      attributes: {
        ids: ['123e4567-e89b-12d3-a456-426614174000'],
        all_records: false,
        all_records_ids_excluded: [],
        values: {},
      },
    },
  },
};

describe('ActionRoute', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();
  const services = factories.forestAdminHttpDriverServices.build();

  let dataSource: DataSource;
  let route: ActionRoute;

  beforeEach(() => {
    jest.resetAllMocks();
    (
      options.forestAdminClient.permissionService.canTriggerCustomAction as jest.Mock
    ).mockResolvedValue(true);
    (
      options.forestAdminClient.permissionService.canApproveCustomAction as jest.Mock
    ).mockResolvedValue(true);
    (
      options.forestAdminClient.permissionService.canRequestCustomActionParameters as jest.Mock
    ).mockResolvedValue(true);
  });

  test('setupRoutes should register three routes', () => {
    dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: { actions: { MySingleAction: null } },
        getForm: jest.fn(),
        execute: jest.fn(),
      }),
    ]);

    route = new ActionRoute(services, options, dataSource, 'books', 'MySingleAction');

    route.setupRoutes(router);

    expect(router.post).toHaveBeenCalledWith(
      '/_actions/books/0/:slug',
      expect.any(Function), // middlewareCustomActionApprovalRequestData
      expect.any(Function),
    );
    expect(router.post).toHaveBeenCalledWith(
      '/_actions/books/0/:slug/hooks/load',
      expect.any(Function),
    );
    expect(router.post).toHaveBeenCalledWith(
      '/_actions/books/0/:slug/hooks/change',
      expect.any(Function),
    );
  });

  describe('middleware CustomActionApprovalRequestData', () => {
    beforeEach(() => {
      dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: { actions: { My_Action: null } },
          getForm: jest.fn(),
          execute: jest.fn(),
        }),
      ]);

      route = new ActionRoute(services, options, dataSource, 'books', 'My_Action');
    });

    describe('when the request contains requester_id', () => {
      test('it should reject with UnprocessableError (prevent forged request)', async () => {
        const context = createMockContext({
          ...baseContext,
          requestBody: {
            data: {
              attributes: {
                ...baseContext.requestBody.data.attributes,
                requester_id: 'requesterId',
              },
            },
          },
        });

        const verifySignedActionParameters = options.forestAdminClient
          .verifySignedActionParameters as jest.Mock;
        const nextMock = jest.fn();

        await expect(
          // @ts-expect-error: test private method
          route.middlewareCustomActionApprovalRequestData.call(route, context, nextMock),
        ).rejects.toThrow(UnprocessableError);

        expect(nextMock).not.toHaveBeenCalled();

        expect(verifySignedActionParameters).not.toHaveBeenCalled();
      });
    });

    describe('when the request is an approval', () => {
      test('it should get the signed parameters and change body', async () => {
        const context = createMockContext({
          ...baseContext,
          requestBody: {
            data: {
              attributes: {
                ...baseContext.requestBody.data.attributes,
                values: { firstname: 'John' },
                signed_approval_request: 'someSignedJWT',
              },
            },
          },
        });

        const verifySignedActionParameters = options.forestAdminClient
          .verifySignedActionParameters as jest.Mock;

        const signedParams = {
          data: {
            attributes: {
              values: { valueFrom: 'JWT' },
              requester_id: 42,
            },
            type: 'typeFromJWT',
          },
        };
        verifySignedActionParameters.mockReturnValue(signedParams);
        const nextMock = jest.fn();

        // @ts-expect-error: test private method
        await route.middlewareCustomActionApprovalRequestData.call(route, context, nextMock);

        expect(nextMock).toHaveBeenCalled();

        expect(verifySignedActionParameters).toHaveBeenCalledWith('someSignedJWT');
        expect(context.request.body).toStrictEqual(signedParams);
      });
    });
  });

  describe('checking user authorization', () => {
    beforeEach(() => {
      dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: {
            actions: { MySingleAction: { scope: 'Single' } },
            fields: { id: factories.columnSchema.uuidPrimaryKey().build() },
          },
          getForm: jest.fn().mockResolvedValue([{ type: 'String', label: 'firstname' }]),
          execute: jest.fn().mockResolvedValue({
            type: 'Error',
            message: 'the result does not matter',
          }),
        }),
      ]);

      route = new ActionRoute(services, options, dataSource, 'books', 'MySingleAction');
    });
    describe('when the request is an approval', () => {
      test('it should resolve when authorized to perform', async () => {
        const context = createMockContext({
          ...baseContext,
          requestBody: {
            data: {
              attributes: {
                ...baseContext.requestBody.data.attributes,
                values: { firstname: 'John' },
                requester_id: 42,
              },
            },
          },
        });

        // @ts-expect-error: test private method
        await expect(route.handleExecute.call(route, context)).resolves.toBe(undefined);
      });

      test('it should reject when not authorized to perform', async () => {
        const context = createMockContext({
          ...baseContext,
          requestBody: {
            data: {
              attributes: {
                ...baseContext.requestBody.data.attributes,
                values: { firstname: 'John' },
                requester_id: 42,
              },
            },
          },
        });

        (
          options.forestAdminClient.permissionService.canApproveCustomAction as jest.Mock
        ).mockResolvedValue(false);

        // @ts-expect-error: test private method
        await expect(route.handleExecute.call(route, context)).rejects.toThrow();
      });
    });

    describe('when the request is a trigger', () => {
      test('it should resolve when authorized to perform', async () => {
        const originalBody = {
          data: {
            attributes: {
              ...baseContext.requestBody.data.attributes,
            },
          },
        };
        const context = createMockContext({
          ...baseContext,
          requestBody: originalBody,
        });

        // @ts-expect-error: test private method
        await expect(route.handleExecute.call(route, context)).resolves.toBe(undefined);
      });

      test('it should reject when not authorized to perform', async () => {
        const originalBody = {
          data: {
            attributes: {
              ...baseContext.requestBody.data.attributes,
            },
          },
        };
        const context = createMockContext({
          ...baseContext,
          requestBody: originalBody,
        });

        (
          options.forestAdminClient.permissionService.canTriggerCustomAction as jest.Mock
        ).mockResolvedValue(false);

        // @ts-expect-error: test private method
        await expect(route.handleExecute.call(route, context)).rejects.toThrow();
      });
    });
  });

  describe('with a single action used from list-view, detail-view & summary', () => {
    beforeEach(() => {
      dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: {
            actions: { MySingleAction: { scope: 'Single' } },
            fields: { id: factories.columnSchema.uuidPrimaryKey().build() },
          },
          getForm: jest.fn().mockResolvedValue([{ type: 'String', label: 'firstname' }]),
          execute: jest.fn().mockResolvedValue({
            type: 'Error',
            message: 'the result does not matter',
          }),
        }),
      ]);

      route = new ActionRoute(services, options, dataSource, 'books', 'MySingleAction');
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

      // @ts-expect-error: test private method
      await route.handleExecute(context);

      expect(dataSource.getCollection('books').execute).toHaveBeenCalledWith(
        { id: '42', email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        'MySingleAction',
        { firstname: 'John' },
        {
          conditionTree: {
            field: 'id',
            operator: 'Equal',
            value: '123e4567-e89b-12d3-a456-426614174000',
          },
          search: null,
          searchExtended: false,
          segment: null,
        },
      );
    });

    test.each([
      [
        'Success (text)',
        {
          type: 'Success',
          message: 'it went great!',
          invalidated: new Set(),
        },
        { success: 'it went great!', refresh: { relationships: [] } },
      ],
      [
        'Success (html)',
        {
          type: 'Success',
          message: 'it went great!',
          html: '<div>Successful</div>',
          invalidated: new Set(),
        },
        {
          success: 'it went great!',
          html: '<div>Successful</div>',
          refresh: { relationships: [] },
        },
      ],
      [
        'Error',
        { type: 'Error', message: 'it went very badly!' },
        { error: 'it went very badly!' },
      ],
      [
        'Error (html)',
        {
          type: 'Error',
          message: 'it went very badly!',
          html: '<div>Because of PEBCAK</div>',
        },
        {
          error: 'it went very badly!',
          html: '<div>Because of PEBCAK</div>',
        },
      ],
      [
        'Webhook',
        {
          type: 'Webhook',
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
        { type: 'Redirect', path: '/route-that-the-frontend-should-go-to' },
        { redirectTo: '/route-that-the-frontend-should-go-to' },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as Array<[string, ActionResult, any]>)(
      'handleExecute should format the response (%s)',
      async (_, executeResult, expectedBody) => {
        // Mock action
        (dataSource.getCollection('books').execute as jest.Mock).mockResolvedValue(executeResult);

        // Test
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

        // @ts-expect-error: test private method
        await route.handleExecute(context);

        expect(context.response.body).toEqual(expectedBody);
      },
    );

    test('handleExecute should format the response (File)', async () => {
      // Mock action
      const stream = Readable.from(['header1,header2mcontent1,content2']);
      (dataSource.getCollection('books').execute as jest.Mock).mockResolvedValue({
        type: 'File',
        name: 'filename.csv',
        mimeType: 'text/csv',
        stream,
      });

      // Test
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

      // @ts-expect-error: test private method
      await route.handleExecute(context);

      expect(context.response.headers).toEqual({
        'access-control-expose-headers': 'Content-Disposition',
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="filename.csv"',
      });
      expect(context.response.body).toBe(stream);
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

      await expect(async () => {
        // @ts-expect-error: test private method
        await route.handleExecute(context);
      }).rejects.toThrow();
    });

    test('handleExecute should throw an error if the user is not authorized', async () => {
      // Test
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

      const canTriggerActions = options.forestAdminClient.permissionService
        .canTriggerCustomAction as jest.Mock;

      canTriggerActions.mockResolvedValue(false);

      // @ts-expect-error: test private method
      await expect(route.handleExecute(context)).rejects.toBeInstanceOf(
        CustomActionTriggerForbiddenError,
      );

      expect(canTriggerActions).toHaveBeenCalledWith({
        customActionName: 'MySingleAction',
        collectionName: 'books',
        userId: '42',
      });
    });

    test('handleHook should throw an error if the user is not authorized', async () => {
      const context = createMockContext(baseContext);

      const canRequestCustomActionParameters = options.forestAdminClient.permissionService
        .canRequestCustomActionParameters as jest.Mock;

      canRequestCustomActionParameters.mockResolvedValue(false);

      // @ts-expect-error: test private method
      await expect(route.handleHook(context)).rejects.toThrow(new ForbiddenError());

      expect(canRequestCustomActionParameters).toHaveBeenCalledWith({
        customActionName: 'MySingleAction',
        collectionName: 'books',
        userId: '42',
      });
    });

    test('handleHook should generate a clean form if called without params', async () => {
      const context = createMockContext(baseContext);

      // @ts-expect-error: test private method
      await route.handleHook(context);

      expect(dataSource.getCollection('books').getForm).toHaveBeenCalledWith(
        { id: '42', email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        'MySingleAction',
        null,
        {
          conditionTree: {
            field: 'id',
            operator: 'Equal',
            value: '123e4567-e89b-12d3-a456-426614174000',
          },
          search: null,
          searchExtended: false,
          segment: null,
        },
      );

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

      // @ts-expect-error: test private method
      await route.handleHook(context);

      expect(dataSource.getCollection('books').getForm).toHaveBeenCalledWith(
        { id: '42', email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        'MySingleAction',
        { firstname: 'John' },
        {
          conditionTree: {
            field: 'id',
            operator: 'Equal',
            value: '123e4567-e89b-12d3-a456-426614174000',
          },
          search: null,
          searchExtended: false,
          segment: null,
        },
      );

      expect(context.response.body).toEqual({ fields: [{ field: 'firstname', type: 'String' }] });
    });
  });

  describe('with a bulk action used from list-view, detail-view & summary', () => {
    beforeEach(() => {
      dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: {
            actions: { MyBulkAction: { scope: 'Bulk' } },
            fields: { id: factories.columnSchema.uuidPrimaryKey().build() },
          },
          getForm: jest.fn().mockResolvedValue([{ type: 'String', label: 'firstname' }]),
          execute: jest.fn().mockResolvedValue({
            type: 'Error',
            message: 'the result does not matter',
          }),
        }),
      ]);

      route = new ActionRoute(services, options, dataSource, 'books', 'MyBulkAction');
    });

    test('handleExecute should delegate to collection with good params', async () => {
      const context = createMockContext({
        ...baseContext,
        requestBody: {
          data: {
            attributes: {
              ...baseContext.requestBody.data.attributes,
              ids: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
              values: { firstname: 'John' },
            },
          },
        },
      });

      // @ts-expect-error: test private method
      await route.handleExecute(context);

      expect(dataSource.getCollection('books').execute).toHaveBeenCalledWith(
        { id: '42', email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        'MyBulkAction',
        { firstname: 'John' },
        {
          conditionTree: {
            field: 'id',
            operator: 'In',
            value: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
          },
          search: null,
          searchExtended: false,
          segment: null,
        },
      );
    });
  });

  describe('with a global action used from list-view, detail-view & summary', () => {
    beforeEach(() => {
      dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: {
            actions: { MyGlobalAction: { scope: 'Global' } },
            fields: { id: factories.columnSchema.uuidPrimaryKey().build() },
          },
          getForm: jest.fn().mockResolvedValue([{ type: 'String', label: 'firstname' }]),
          execute: jest.fn().mockResolvedValue({
            type: 'Error',
            message: 'the result does not matter',
          }),
        }),
      ]);

      route = new ActionRoute(services, options, dataSource, 'books', 'MyGlobalAction');
    });

    test('should ignore record selection', async () => {
      const context = createMockContext({
        ...baseContext,
        requestBody: {
          data: {
            attributes: {
              ...baseContext.requestBody.data.attributes,
              all_records: true,
            },
          },
        },
      });

      // @ts-expect-error: test private method
      await route.handleExecute(context);

      expect(dataSource.getCollection('books').execute).toHaveBeenCalledWith(
        { id: '42', email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        'MyGlobalAction',
        expect.any(Object),
        new Filter({
          // no condition tree!
          conditionTree: null,
          search: null,
          searchExtended: false,
          segment: null,
        }),
      );
    });
  });

  describe('with a single action used from related-data', () => {
    beforeEach(() => {
      dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'reviews',
          schema: {
            actions: { MySingleAction: { scope: 'Single' } },
            fields: { id: factories.columnSchema.uuidPrimaryKey().build() },
          },
          getForm: jest.fn().mockResolvedValue([{ type: 'String', label: 'firstname' }]),
          execute: jest.fn(),
        }),
        factories.collection.build({
          name: 'books',
          schema: {
            fields: {
              id: factories.columnSchema.uuidPrimaryKey().build(),
              reviews: factories.oneToManySchema.build({
                foreignCollection: 'reviews',
              }),
            },
          },
          getForm: jest.fn().mockResolvedValue([{ type: 'String', label: 'firstname' }]),
          execute: jest.fn(),
        }),
      ]);

      route = new ActionRoute(services, options, dataSource, 'reviews', 'MySingleAction');
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
              values: { firstname: 'John' },
            },
          },
        },
      });
      dataSource.getCollection('reviews').execute = jest.fn().mockReturnValue({
        type: 'Webhook',
      });

      // @ts-expect-error: test private method
      await route.handleExecute(context);

      expect(dataSource.getCollection('reviews').execute).toHaveBeenCalledWith(
        { id: '42', email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        'MySingleAction',
        expect.any(Object),
        new Filter({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: 'And',
            conditions: [
              factories.conditionTreeLeaf.build({
                field: 'id',
                operator: 'Equal',
                value: '123e4567-e89b-12d3-a456-426614174000',
              }),
              factories.conditionTreeLeaf.build({
                field: 'reviewId',
                operator: 'Equal',
                value: '00000000-0000-4000-8000-000000000000',
              }),
            ],
          }),
          search: null,
          searchExtended: false,
          segment: null,
        }),
      );
    });
  });

  describe('with a bulk action used from related-data', () => {
    beforeEach(() => {
      dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'reviews',
          schema: {
            actions: { MyBulkAction: { scope: 'Bulk' } },
            fields: { id: factories.columnSchema.uuidPrimaryKey().build() },
          },
          getForm: jest.fn().mockResolvedValue([{ type: 'String', label: 'firstname' }]),
          execute: jest.fn(),
        }),
        factories.collection.build({
          name: 'books',
          schema: {
            fields: {
              id: factories.columnSchema.uuidPrimaryKey().build(),
              reviews: factories.oneToManySchema.build({
                foreignCollection: 'reviews',
              }),
            },
          },
          getForm: jest.fn().mockResolvedValue([{ type: 'String', label: 'firstname' }]),
          execute: jest.fn(),
        }),
      ]);

      route = new ActionRoute(services, options, dataSource, 'reviews', 'MyBulkAction');
    });

    test('should apply the handler only on the related data', async () => {
      const context = createMockContext({
        ...baseContext,
        requestBody: {
          data: {
            attributes: {
              ...baseContext.requestBody.data.attributes,
              ids: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
              parent_association_name: 'reviews',
              parent_collection_name: 'books',
              parent_collection_id: '00000000-0000-4000-8000-000000000000',
              values: { firstname: 'John' },
            },
          },
        },
      });
      dataSource.getCollection('reviews').execute = jest.fn().mockReturnValue({
        type: 'Webhook',
      });

      // @ts-expect-error: test private method
      await route.handleExecute(context);

      expect(dataSource.getCollection('reviews').execute).toHaveBeenCalledWith(
        { id: '42', email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        'MyBulkAction',
        expect.any(Object),
        new Filter({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: 'And',
            conditions: [
              factories.conditionTreeLeaf.build({
                field: 'id',
                operator: 'In',
                value: [
                  '123e4567-e89b-12d3-a456-426614174000',
                  '123e4567-e89b-12d3-a456-426614174001',
                ],
              }),
              factories.conditionTreeLeaf.build({
                field: 'reviewId',
                operator: 'Equal',
                value: '00000000-0000-4000-8000-000000000000',
              }),
            ],
          }),
          search: null,
          searchExtended: false,
          segment: null,
        }),
      );
    });
  });
});
