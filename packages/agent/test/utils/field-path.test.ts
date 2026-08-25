import FieldPathUtils from '../../src/utils/field-path';
import * as factories from '../__factories__';

describe('FieldPathUtils', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'cards',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          panLast4: factories.columnSchema.build({ columnType: 'String' }),
          accountId: factories.columnSchema.build({ columnType: 'Uuid' }),
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
          id: factories.columnSchema.uuidPrimaryKey().build(),
          iban: factories.columnSchema.build({ columnType: 'String' }),
          organizationId: factories.columnSchema.build({ columnType: 'Uuid' }),
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
          id: factories.columnSchema.uuidPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: 'String' }),
        },
      }),
    }),
  ]);

  describe('getLeafCollection', () => {
    it('should return the collection itself for a plain column', () => {
      const owner = FieldPathUtils.getLeafCollection(dataSource.getCollection('cards'), 'panLast4');

      expect(owner.name).toEqual('cards');
    });

    it('should return the collection the relation points to for a one hop path', () => {
      const owner = FieldPathUtils.getLeafCollection(
        dataSource.getCollection('cards'),
        'account:iban',
      );

      expect(owner.name).toEqual('accounts');
    });

    it('should return the last collection of the path, not the ones crossed on the way', () => {
      const owner = FieldPathUtils.getLeafCollection(
        dataSource.getCollection('cards'),
        'account:organization:name',
      );

      expect(owner.name).toEqual('organizations');
    });

    it('should return the root collection for a self referencing relation', () => {
      const cards = dataSource.getCollection('cards');
      cards.schema.fields.parent = factories.manyToOneSchema.build({
        foreignCollection: 'cards',
        foreignKey: 'id',
      });

      expect(FieldPathUtils.getLeafCollection(cards, 'parent:panLast4').name).toEqual('cards');
    });
  });
});
