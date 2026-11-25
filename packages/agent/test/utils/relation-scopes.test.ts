import type { Filter } from '@forestadmin/datasource-toolkit';

import { ConditionTreeLeaf, Projection } from '@forestadmin/datasource-toolkit';

import RelationScopes from '../../src/utils/relation-scopes';
import * as factories from '../__factories__';

describe('RelationScopes', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'cards',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.numericPrimaryKey().build(),
          accountId: factories.columnSchema.build({ columnType: 'Number' }),
          account: factories.manyToOneSchema.build({
            foreignCollection: 'accounts',
            foreignKey: 'accountId',
          }),
        },
      }),
    }),
    factories.collection.build({
      name: 'accounts',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.numericPrimaryKey().build(),
          iban: factories.columnSchema.build({ columnType: 'String' }),
          openedAt: factories.columnSchema.build({ columnType: 'Date' }),
          organizationId: factories.columnSchema.build({ columnType: 'Number' }),
          organization: factories.manyToOneSchema.build({
            foreignCollection: 'organizations',
            foreignKey: 'organizationId',
          }),
        },
      }),
    }),
    factories.collection.build({
      name: 'organizations',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.numericPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: 'String' }),
          tier: factories.columnSchema.build({ columnType: 'String' }),
        },
      }),
    }),
  ]);
  const accounts = dataSource.getCollection('accounts');
  const organizations = dataSource.getCollection('organizations');
  const accountScope = {
    path: 'account',
    collection: accounts,
    scope: new ConditionTreeLeaf('organization:name', 'Equal', 'OwnOrg'),
  };
  const organizationScope = {
    path: 'account:organization',
    collection: organizations,
    scope: new ConditionTreeLeaf('tier', 'Equal', 'gold'),
  };

  const caller = factories.caller.build();
  const inScope = (collection, ids: number[]) =>
    jest
      .spyOn(collection, 'list')
      .mockReset()
      .mockResolvedValue(ids.map(id => ({ id })));

  afterEach(() => jest.restoreAllMocks());

  describe('withRelatedKeys', () => {
    test('should add the primary key of each scoped related record', () => {
      const relationScopes = new RelationScopes([accountScope, organizationScope]);

      expect(relationScopes.withRelatedKeys(new Projection('id', 'account:iban'))).toEqual([
        'id',
        'account:iban',
        'account:id',
        'account:organization:id',
      ]);
    });

    test('should leave the projection as is when no relation is scoped', () => {
      expect(new RelationScopes().withRelatedKeys(new Projection('id', 'account:iban'))).toEqual([
        'id',
        'account:iban',
      ]);
    });
  });

  describe('redact', () => {
    const projection = new Projection('id', 'account:iban');

    test('should empty a related record outside its scope and keep the root record', async () => {
      inScope(accounts, [10]);
      const relationScopes = new RelationScopes([accountScope]);

      const records = await relationScopes.redact(
        [
          { id: 1, account: { id: 10, iban: 'FR76' } },
          { id: 2, account: { id: 20, iban: 'DE22' } },
        ],
        projection,
        caller,
      );

      expect(records).toEqual([
        { id: 1, account: { iban: 'FR76' } },
        { id: 2, account: null },
      ]);
    });

    test('should ask the datasource which related records are in scope, in one query', async () => {
      const list = inScope(accounts, []);
      const relationScopes = new RelationScopes([accountScope]);

      await relationScopes.redact(
        [
          { id: 1, account: { id: 10 } },
          { id: 2, account: { id: 20 } },
        ],
        projection,
        caller,
      );

      expect(list).toHaveBeenCalledTimes(1);
      expect((list.mock.calls[0][1] as Filter).conditionTree).toEqual(
        expect.objectContaining({
          aggregator: 'And',
          conditions: [
            expect.objectContaining({ field: 'id', operator: 'In', value: [10, 20] }),
            expect.objectContaining({ field: 'organization:name', value: 'OwnOrg' }),
          ],
        }),
      );
    });

    test('should keep a related record the datasource matches on a date scope', async () => {
      inScope(accounts, [10]);
      const relationScopes = new RelationScopes([
        {
          path: 'account',
          collection: accounts,
          scope: new ConditionTreeLeaf('openedAt', 'GreaterThan', '2024-01-01T00:00:00.000Z'),
        },
      ]);

      const records = await relationScopes.redact(
        [{ id: 1, account: { id: 10, openedAt: new Date('2025-06-01') } }],
        new Projection('id', 'account:openedAt'),
        caller,
      );

      expect(records).toEqual([{ id: 1, account: { openedAt: new Date('2025-06-01') } }]);
    });

    test('should keep a missing related record missing without querying', async () => {
      const list = inScope(accounts, []);
      const relationScopes = new RelationScopes([accountScope]);

      const records = await relationScopes.redact([{ id: 4, account: null }], projection, caller);

      expect(records).toEqual([{ id: 4, account: null }]);
      expect(list).not.toHaveBeenCalled();
    });

    test('should empty a record reached through several relations', async () => {
      inScope(organizations, [100]);
      const relationScopes = new RelationScopes([organizationScope]);

      const records = await relationScopes.redact(
        [
          { id: 1, account: { iban: 'FR76', organization: { id: 100, name: 'OwnOrg' } } },
          { id: 2, account: { iban: 'FR14', organization: { id: 200, name: 'OwnOrg' } } },
        ],
        new Projection('id', 'account:iban', 'account:organization:name'),
        caller,
      );

      expect(records).toEqual([
        { id: 1, account: { iban: 'FR76', organization: { name: 'OwnOrg' } } },
        { id: 2, account: { iban: 'FR14', organization: null } },
      ]);
    });

    test('should return the records untouched when no relation is scoped', async () => {
      const records = [{ id: 1, account: { iban: 'FR76', extra: true } }];

      expect(await new RelationScopes().redact(records, projection, caller)).toBe(records);
    });
  });
});
