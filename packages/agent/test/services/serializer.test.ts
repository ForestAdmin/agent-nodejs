import { Collection, FieldTypes, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import Serializer from '../../src/services/serializer';

const serializer = new Serializer('/forest');
const dataSource = { collections: [] };
dataSource.collections.push({
  dataSource,
  name: 'book',
  schema: {
    fields: {
      isbn: { type: FieldTypes.Column, columnType: PrimitiveTypes.String, isPrimaryKey: true },
      title: { type: FieldTypes.Column, columnType: PrimitiveTypes.String },
      reviews: { type: FieldTypes.OneToMany, foreignCollection: 'review' },
      author: { type: FieldTypes.ManyToOne, foreignCollection: 'person' },
    },
  },
});
dataSource.collections.push({
  dataSource,
  name: 'person',
  schema: {
    fields: {
      birthdate: { type: FieldTypes.Column, columnType: PrimitiveTypes.String, isPrimaryKey: true },
      firstName: { type: FieldTypes.Column, columnType: PrimitiveTypes.String },
      lastName: { type: FieldTypes.Column, columnType: PrimitiveTypes.String, isPrimaryKey: true },
    },
  },
});

const record = {
  isbn: '9780345317988',
  author: { birthdate: '1920-01-02', firstName: 'Isaac', lastName: 'Asimov' },
  title: 'Foundation',
};

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
      const result = serializer.serialize(dataSource.collections[0] as Collection, record);
      expect(result).toStrictEqual(serializedRecord);
    });
  });

  describe('deserialize', () => {
    test('should deserialize a json api into a record', () => {
      const result = serializer.deserialize(
        dataSource.collections[0] as Collection,
        serializedRecord,
      );
      expect(result).toStrictEqual(record);
    });
  });
});
