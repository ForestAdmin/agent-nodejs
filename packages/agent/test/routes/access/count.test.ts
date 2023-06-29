import { createMockContext } from '@shopify/jest-koa-mocks';

import Count from '../../../src/routes/access/count';
import * as factories from '../../__factories__';

describe('CountRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  describe('for countable collections', () => {
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({ name: 'books', schema: { countable: true } }),
    );

    test('should register "/books/count" route', () => {
      const list = new Count(services, options, dataSource, 'books');
      list.setupRoutes(router);

      expect(router.get).toHaveBeenCalledWith('/books/count', expect.any(Function));
    });

    test('should aggregate the data and return the result', async () => {
      const aggregateSpy = jest.fn().mockReturnValue([{ value: 2 }]);
      dataSource.getCollection('books').aggregate = aggregateSpy;
      const count = new Count(services, options, dataSource, 'books');
      const context = createMockContext({
        customProperties: { query: { timezone: 'Europe/Paris' } },
        state: { user: { email: 'john.doe@domain.com' } },
      });

      await count.handleCount(context);

      expect(aggregateSpy).toHaveBeenCalledWith(
        { email: 'john.doe@domain.com', requestId: expect.any(String), timezone: 'Europe/Paris' },
        { conditionTree: null, search: null, searchExtended: false, segment: null },
        { operation: 'Count' },
      );
      expect(context.response.body).toEqual({ count: 2 });
    });

    test('should check that the user has permission to count', async () => {
      const aggregateSpy = jest.fn().mockReturnValue([{ value: 2 }]);
      dataSource.getCollection('books').aggregate = aggregateSpy;
      const count = new Count(services, options, dataSource, 'books');
      const context = createMockContext({
        customProperties: { query: { timezone: 'Europe/Paris' } },
        state: { user: { email: 'john.doe@domain.com' } },
      });

      await count.handleCount(context);

      expect(services.authorization.assertCanBrowse).toHaveBeenCalledWith(context, 'books');

      expect(context.response.body).toEqual({ count: 2 });
    });

    test('it should apply the scope', async () => {
      const aggregateSpy = jest.fn().mockReturnValue([{ value: 2 }]);
      dataSource.getCollection('books').aggregate = aggregateSpy;
      const count = new Count(services, options, dataSource, 'books');
      const context = createMockContext({
        customProperties: { query: { timezone: 'Europe/Paris' } },
        state: { user: { email: 'john.doe@domain.com' } },
      });

      const getScopeMock = services.authorization.getScope as jest.Mock;
      getScopeMock.mockResolvedValueOnce({
        field: 'title',
        operator: 'NotContains',
        value: '[test]',
      });

      await count.handleCount(context);

      expect(aggregateSpy).toHaveBeenCalledWith(
        { email: 'john.doe@domain.com', requestId: expect.any(String), timezone: 'Europe/Paris' },
        {
          conditionTree: {
            field: 'title',
            operator: 'NotContains',
            value: '[test]',
          },
          search: null,
          searchExtended: false,
          segment: null,
        },
        { operation: 'Count' },
      );
      expect(context.response.body).toEqual({ count: 2 });
      expect(services.authorization.getScope).toHaveBeenCalledWith(
        dataSource.getCollection('books'),
        context,
      );
    });
  });

  describe('for non countable collections', () => {
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({ name: 'books', schema: { countable: false } }),
    );

    test('should return a predefined response', async () => {
      const count = new Count(services, options, dataSource, 'books');
      const context = createMockContext({
        customProperties: { query: { timezone: 'Europe/Paris' } },
        state: { user: { email: 'john.doe@domain.com' } },
      });

      await count.handleCount(context);

      expect(dataSource.getCollection('books').aggregate).not.toHaveBeenCalled();
      expect(context.response.body).toEqual({ meta: { count: 'deactivated' } });
    });
  });
});
