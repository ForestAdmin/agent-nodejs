import { createMockContext } from '@shopify/jest-koa-mocks';

import isRecordVisible, { recordExists } from '../../src/audit-trail/scope';
import * as factories from '../__factories__';

describe('audit-trail scope', () => {
  const buildCollection = () =>
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: { id: factories.columnSchema.numericPrimaryKey().build() },
      }),
    });

  const buildContext = () =>
    createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
    });

  describe('recordExists', () => {
    test('returns true when the (possibly scoped) query matches the id', async () => {
      const collection = buildCollection();
      jest.spyOn(collection, 'list').mockResolvedValue([{ id: 2 }]);

      await expect(recordExists(collection, '2', buildContext(), null)).resolves.toBe(true);
    });

    test('returns false when the query matches nothing', async () => {
      const collection = buildCollection();
      jest.spyOn(collection, 'list').mockResolvedValue([]);

      await expect(recordExists(collection, '2', buildContext(), null)).resolves.toBe(false);
    });

    test('intersects the given scope into the query', async () => {
      const collection = buildCollection();
      const scope = { field: 'ownerId', operator: 'Equal', value: 1 };
      const list = jest.spyOn(collection, 'list').mockResolvedValue([]);

      await recordExists(collection, '2', buildContext(), scope as never);

      expect(list).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          conditionTree: expect.objectContaining({
            aggregator: 'And',
            conditions: expect.arrayContaining([expect.objectContaining(scope)]),
          }),
        }),
        expect.anything(),
      );
    });
  });

  describe('isRecordVisible', () => {
    test('is visible without querying anything when no scope is configured', async () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const collection = buildCollection();
      const list = jest.spyOn(collection, 'list');

      await expect(isRecordVisible(services, collection, '2', buildContext())).resolves.toBe(true);
      expect(list).not.toHaveBeenCalled();
    });

    test('is visible when the id matches the scope', async () => {
      const services = factories.forestAdminHttpDriverServices.build();
      (services.authorization.getScope as jest.Mock).mockResolvedValue({
        field: 'ownerId',
        operator: 'Equal',
        value: 1,
      });
      const collection = buildCollection();
      jest.spyOn(collection, 'list').mockResolvedValueOnce([{ id: 2 }]);

      await expect(isRecordVisible(services, collection, '2', buildContext())).resolves.toBe(true);
    });

    test('is not visible when the id still exists but fails the scope', async () => {
      const services = factories.forestAdminHttpDriverServices.build();
      (services.authorization.getScope as jest.Mock).mockResolvedValue({
        field: 'ownerId',
        operator: 'Equal',
        value: 1,
      });
      const collection = buildCollection();
      jest
        .spyOn(collection, 'list')
        .mockResolvedValueOnce([]) // scoped: not in scope
        .mockResolvedValueOnce([{ id: 2 }]); // bare: still exists

      await expect(isRecordVisible(services, collection, '2', buildContext())).resolves.toBe(false);
    });

    test('is visible when the id no longer exists at all, scope aside', async () => {
      const services = factories.forestAdminHttpDriverServices.build();
      (services.authorization.getScope as jest.Mock).mockResolvedValue({
        field: 'ownerId',
        operator: 'Equal',
        value: 1,
      });
      const collection = buildCollection();
      const list = jest
        .spyOn(collection, 'list')
        .mockResolvedValueOnce([]) // scoped: not found
        .mockResolvedValueOnce([]); // bare: genuinely gone

      await expect(isRecordVisible(services, collection, '2', buildContext())).resolves.toBe(true);
      expect(list).toHaveBeenCalledTimes(2);
    });
  });
});
