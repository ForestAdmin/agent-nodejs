import { FieldTypes } from '../../src/interfaces/schema';
import SchemaUtils from '../../src/utils/schema';
import * as factories from '../__factories__';

describe('SchemaUtils', () => {
  describe('getPrimaryKeys', () => {
    const schema = factories.collectionSchema.build({
      fields: {
        id: { type: FieldTypes.Column, isPrimaryKey: true },
        notId: { type: FieldTypes.Column, isPrimaryKey: false },
        otherId: { type: FieldTypes.Column, isPrimaryKey: true },
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
        id: factories.columnSchema.build({ isPrimaryKey: true }),

        // used in relation
        bookId: factories.columnSchema.build({}),

        // not used in relation
        name: factories.columnSchema.build({}),

        idModel: factories.manyToOneSchema.build({
          type: FieldTypes.ManyToOne,
          foreignCollection: 'otherCollection',
          foreignKey: 'id',
        }),

        book: factories.manyToOneSchema.build({
          type: FieldTypes.ManyToOne,
          foreignCollection: 'books',
          foreignKey: 'bookId',
        }),
      },
    });

    test('id is not solely a fk', () => {
      const result = SchemaUtils.isSolelyForeignKey(schema, 'id');

      expect(result).toBeFalsy();
    });

    test('bookId is solely a fk', () => {
      const result = SchemaUtils.isSolelyForeignKey(schema, 'bookId');

      expect(result).toBeTruthy();
    });

    test('name is not solely a fk', () => {
      const result = SchemaUtils.isSolelyForeignKey(schema, 'name');

      expect(result).toBeFalsy();
    });

    test('book is not solely a fk', () => {
      const result = SchemaUtils.isSolelyForeignKey(schema, 'book');

      expect(result).toBeFalsy();
    });
  });
});
