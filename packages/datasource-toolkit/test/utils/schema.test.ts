import * as factories from '../__factories__';
import SchemaUtils from '../../src/utils/schema';

describe('SchemaUtils', () => {
  describe('isPrimaryKey', () => {
    const schema = factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.uuidPrimaryKey().build(),
        notId: factories.columnSchema.build({ isPrimaryKey: false }),
        otherId: factories.columnSchema.uuidPrimaryKey().build(),
      },
    });

    test('should return true when it is a pk', () => {
      expect(SchemaUtils.isPrimaryKey(schema, 'id')).toBe(true);
    });

    test('should return false when it is not a pk', () => {
      expect(SchemaUtils.isPrimaryKey(schema, 'notId')).toBe(false);
    });
  });

  describe('getPrimaryKeys', () => {
    const schema = factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.uuidPrimaryKey().build(),
        notId: factories.columnSchema.build({ isPrimaryKey: false }),
        otherId: factories.columnSchema.uuidPrimaryKey().build(),
      },
    });

    test('should find the pks', () => {
      const result = SchemaUtils.getPrimaryKeys(schema);

      expect(result).toStrictEqual(['id', 'otherId']);
    });
  });

  describe('isSolelyForeignKey', () => {
    const schema = factories.collectionSchema.build({
      fields: {
        // pk + used in relation
        id: factories.columnSchema.uuidPrimaryKey().build(),

        // used in relation
        bookId: factories.columnSchema.build({}),

        // not used in relation
        name: factories.columnSchema.build({}),

        idModel: factories.manyToOneSchema.build({
          foreignCollection: 'otherCollection',
          foreignKey: 'id',
        }),

        book: factories.manyToOneSchema.build({
          foreignCollection: 'books',
          foreignKey: 'bookId',
        }),
      },
    });

    test('id is a fk', () => {
      const result = SchemaUtils.isForeignKey(schema, 'id');

      expect(result).toBe(true);
    });

    test('bookId is a fk', () => {
      const result = SchemaUtils.isForeignKey(schema, 'bookId');

      expect(result).toBe(true);
    });

    test('name is not a fk', () => {
      const result = SchemaUtils.isForeignKey(schema, 'name');

      expect(result).toBe(false);
    });

    test('book is not a fk', () => {
      const result = SchemaUtils.isForeignKey(schema, 'book');

      expect(result).toBe(false);
    });
  });

  describe('getToManyRelation', () => {
    test('should returns the relation when the relation is a many to many', () => {
      const schema = factories.collectionSchema.build({
        fields: {
          field: factories.manyToManySchema.build(),
        },
      });

      expect(SchemaUtils.getToManyRelation(schema, 'field')).toEqual(
        factories.manyToManySchema.build(),
      );
    });

    test('should returns the relation when the relation is a one to many', () => {
      const schema = factories.collectionSchema.build({
        fields: {
          field: factories.oneToManySchema.build(),
        },
      });

      expect(SchemaUtils.getToManyRelation(schema, 'field')).toEqual(
        factories.oneToManySchema.build(),
      );
    });

    test('should throw an error when the relation is not expected', () => {
      const schema = factories.collectionSchema.build({
        fields: {
          field: factories.manyToOneSchema.build(),
        },
      });

      expect(() => SchemaUtils.getToManyRelation(schema, 'field')).toThrow(
        'Relation field has invalid type should be one of OneToMany or ManyToMany.',
      );
    });

    test('should throw an error when the relation is not inside model', () => {
      const schema = factories.collectionSchema.build({});

      expect(() => SchemaUtils.getToManyRelation(schema, 'anUnknownRelation')).toThrow(
        `Relation 'anUnknownRelation' not found`,
      );
    });
  });
});
