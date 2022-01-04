import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import Serializer from '../../src/services/serializer';
import factories from '../factories';

const serializer = new Serializer('/forest');
const dataSource = factories.dataSource.build({ collections: [] });
dataSource.collections.push(
  factories.collection.build({
    dataSource,
    name: 'book',
    schema: factories.collectionSchema.build({
      fields: {
        isbn: factories.columnSchema.build({
          columnType: PrimitiveTypes.String,
          isPrimaryKey: true,
        }),
        title: factories.columnSchema.build({
          columnType: PrimitiveTypes.String,
        }),
        reviews: factories.oneToManySchema.build({
          foreignCollection: 'review',
        }),
        author: factories.manyToOne.build({
          foreignCollection: 'person',
          foreignKey: null,
        }),
      },
    }),
  }),
);
dataSource.collections.push(
  factories.collection.build({
    dataSource,
    name: 'person',
    schema: factories.collectionSchema.build({
      fields: {
        birthdate: factories.columnSchema.build({
          columnType: PrimitiveTypes.String,
          isPrimaryKey: true,
        }),
        firstName: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
        lastName: factories.columnSchema.build({
          columnType: PrimitiveTypes.String,
          isPrimaryKey: true,
        }),
      },
    }),
  }),
);

const record = factories.recordData.build({
  isbn: '9780345317988',
  author: { birthdate: '1920-01-02', firstName: 'Isaac', lastName: 'Asimov' },
  title: 'Foundation',
});

const serializedRecord = {
  data: {
    type: 'book',
    id: '9780345317988',
    attributes: { isbn: '9780345317988', title: 'Foundation' },
    relationships: {
      author: {
        data: { type: 'person', id: '1920-01-02|Asimov' },
      },
      reviews: {
        links: { related: '/forest/book/9780345317988/relationships/reviews' },
      },
    },
  },
  included: [
    {
      type: 'person',
      id: '1920-01-02|Asimov',
      attributes: { birthdate: '1920-01-02', firstName: 'Isaac', lastName: 'Asimov' },
    },
  ],
  jsonapi: { version: '1.0' },
};

describe('serializer', () => {
  describe('serialize', () => {
    test('should serialize a record with relations', () => {
      const result = serializer.serialize(dataSource.collections[0], record);
      expect(result).toStrictEqual(serializedRecord);
    });
  });

  describe('deserialize', () => {
    test('should deserialize a json api into a record', () => {
      const result = serializer.deserialize(dataSource.collections[0], serializedRecord);
      expect(result).toStrictEqual(record);
    });
  });
});
