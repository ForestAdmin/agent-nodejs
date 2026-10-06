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
            cover: factories.oneToOneSchema.build({
              foreignCollection: 'covers',
              originKey: 'bookId',
            }),
            reviews: factories.oneToManySchema.build({
              foreignCollection: 'reviews',
              originKey: 'bookId',
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

    it('should apply on top of overridden fields', () => {
      const { collection, decorator } = buildDecorator();

      decorator.overrideSchema({ fields: { ...collection.schema.fields } });
      decorator.disableFieldFiltering('authorId');

      expect(decorator.schema.fields.authorId).toEqual(
        expect.objectContaining({ filterOperators: new Set() }),
      );
    });

    it('should throw on a primary key', () => {
      const { decorator } = buildDecorator();

      expect(() => decorator.disableFieldFiltering('id')).toThrow(
        "Cannot disable filtering on primary key 'books.id'",
      );
    });

    it.each(['author', 'cover'])('should mark the %s relation as not filterable', name => {
      const { collection, decorator } = buildDecorator();

      decorator.disableFieldFiltering(name);

      expect(decorator.schema.fields[name]).toEqual({
        ...collection.schema.fields[name],
        isFilterable: false,
      });
    });

    it('should throw on a one to many relation', () => {
      const { decorator } = buildDecorator();

      expect(() => decorator.disableFieldFiltering('reviews')).toThrow(
        "Unexpected field type: 'books.reviews' (found 'OneToMany' expected 'Column', 'ManyToOne' or 'OneToOne')",
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
