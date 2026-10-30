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

  describe('withScopeFields', () => {
    test('should add the fields each scope reads, nested under its relation', () => {
      const relationScopes = new RelationScopes([accountScope, organizationScope]);

      expect(relationScopes.withScopeFields(new Projection('id', 'account:iban'))).toEqual([
        'id',
        'account:iban',
        'account:organization:name',
        'account:organization:tier',
      ]);
    });

    test('should leave the projection as is when no relation is scoped', () => {
      expect(new RelationScopes().withScopeFields(new Projection('id', 'account:iban'))).toEqual([
        'id',
        'account:iban',
      ]);
    });
  });

  describe('redact', () => {
    const projection = new Projection('id', 'account:iban');

    test('should empty a related record outside its scope and keep the root record', () => {
      const relationScopes = new RelationScopes([accountScope]);

      const records = relationScopes.redact(
        [
          { id: 1, account: { iban: 'FR76', organization: { name: 'OwnOrg' } } },
          { id: 2, account: { iban: 'DE22', organization: { name: 'AnotherTenant' } } },
        ],
        projection,
        'Europe/Paris',
      );

      expect(records).toEqual([
        { id: 1, account: { iban: 'FR76' } },
        { id: 2, account: null },
      ]);
    });

    test('should keep a missing related record missing', () => {
      const relationScopes = new RelationScopes([accountScope]);

      const records = relationScopes.redact([{ id: 4, account: null }], projection, 'Europe/Paris');

      expect(records).toEqual([{ id: 4, account: null }]);
    });

    test('should empty a record reached through several relations', () => {
      const relationScopes = new RelationScopes([organizationScope]);

      const records = relationScopes.redact(
        [
          { id: 1, account: { iban: 'FR76', organization: { name: 'OwnOrg', tier: 'gold' } } },
          { id: 2, account: { iban: 'FR14', organization: { name: 'OwnOrg', tier: 'silver' } } },
        ],
        new Projection('id', 'account:iban', 'account:organization:name'),
        'Europe/Paris',
      );

      expect(records).toEqual([
        { id: 1, account: { iban: 'FR76', organization: { name: 'OwnOrg' } } },
        { id: 2, account: { iban: 'FR14', organization: null } },
      ]);
    });

    test('should evaluate a deeper scope on the record before its parent is emptied', () => {
      const relationScopes = new RelationScopes([accountScope, organizationScope]);

      const records = relationScopes.redact(
        [{ id: 2, account: { iban: 'DE22', organization: { name: 'AnotherTenant', tier: 'x' } } }],
        new Projection('id', 'account:iban', 'account:organization:name'),
        'Europe/Paris',
      );

      expect(records).toEqual([{ id: 2, account: null }]);
    });

    test('should return the records untouched when no relation is scoped', () => {
      const records = [{ id: 1, account: { iban: 'FR76', extra: true } }];

      expect(new RelationScopes().redact(records, projection, 'Europe/Paris')).toBe(records);
    });
  });
});
