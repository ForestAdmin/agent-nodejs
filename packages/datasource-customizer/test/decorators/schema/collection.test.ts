import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import SchemaCollectionDecorator from '../../../src/decorators/schema/collection';

describe('SchemaCollectionDecorator', () => {
  it('should overwrite fields from the schema', async () => {
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({ countable: true }),
    });

    const decorator = new SchemaCollectionDecorator(collection, null);
    decorator.overrideSchema({ countable: false });

    expect(collection.schema.countable).toBe(true);
    expect(decorator.schema.countable).toBe(false);
  });

  describe('disableFieldFiltering', () => {
    const buildDecorator = () => {
      const collection = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build({
              filterOperators: new Set(['Equal', 'In']),
            }),
            authorId: factories.columnSchema.build({
              filterOperators: new Set(['Equal', 'In', 'Present']),
            }),
            title: factories.columnSchema.build({ filterOperators: new Set(['Equal']) }),
            author: factories.manyToOneSchema.build({
              foreignCollection: 'authors',
              foreignKey: 'authorId',
            }),
          },
        }),
      });

      return { collection, decorator: new SchemaCollectionDecorator(collection, null) };
    };

    it('should expose an empty operator set on the field', () => {
      const { decorator } = buildDecorator();

      decorator.disableFieldFiltering('authorId');

      expect(decorator.schema.fields.authorId).toEqual(
        expect.objectContaining({ type: 'Column', filterOperators: new Set() }),
      );
    });

    it('should keep the operators of the child collection', () => {
      const { collection, decorator } = buildDecorator();

      decorator.disableFieldFiltering('authorId');

      expect(collection.schema.fields.authorId).toEqual(
        expect.objectContaining({ filterOperators: new Set(['Equal', 'In', 'Present']) }),
      );
    });

    it('should leave the other fields untouched', () => {
      const { decorator } = buildDecorator();

      decorator.disableFieldFiltering('authorId');

      expect(decorator.schema.fields.title).toEqual(
        expect.objectContaining({ filterOperators: new Set(['Equal']) }),
      );
    });

    it('should throw on a primary key', () => {
      const { decorator } = buildDecorator();

      expect(() => decorator.disableFieldFiltering('id')).toThrow(
        "Cannot disable filtering on primary key 'books.id'",
      );
    });

    it('should throw on a relation', () => {
      const { decorator } = buildDecorator();

      expect(() => decorator.disableFieldFiltering('author')).toThrow(
        "Unexpected field type: 'books.author' (found 'ManyToOne' expected 'Column')",
      );
    });

    it('should throw on an unknown field', () => {
      const { decorator } = buildDecorator();

      expect(() => decorator.disableFieldFiltering('unknown')).toThrow(
        "The 'books.unknown' field was not found",
      );
    });
  });
});
