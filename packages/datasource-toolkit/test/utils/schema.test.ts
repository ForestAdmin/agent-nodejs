import {
  AlreadyDefinedFieldError,
  MissingColumnError,
  MissingFieldError,
  MissingRelationError,
  RelationFieldAccessDeniedError,
} from '../../src';
import SchemaUtils from '../../src/utils/schema';
import * as factories from '../__factories__';

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
        MissingRelationError,
      );
    });
  });

  describe('getColumnNames', () => {
    it('should return all the field names without the relations', () => {
      const schema = factories.collectionSchema.build({
        fields: {
          relation: factories.manyToManySchema.build(),
          field: factories.columnSchema.build({}),
        },
      });

      expect(SchemaUtils.getColumnNames(schema)).toEqual(['field']);
    });
  });

  describe('getRelation', () => {
    describe('when accessing field from relation', () => {
      it('should deny the access', () => {
        expect(() =>
          SchemaUtils.getRelation(factories.collectionSchema.build(), 'relation:field'),
        ).toThrow(RelationFieldAccessDeniedError);
      });
    });

    describe('when relation does not exist', () => {
      it('should throw an error', () => {
        expect(() =>
          SchemaUtils.getRelation(factories.collectionSchema.build(), 'relation'),
        ).toThrow(MissingRelationError);
      });
    });

    describe('when relation exists', () => {
      it('should return the relation', () => {
        const schema = factories.collectionSchema.build({
          fields: { relation: factories.manyToManySchema.build() },
        });

        expect(SchemaUtils.getRelation(schema, 'relation')).toEqual(schema.fields.relation);
      });
    });

    describe('when asking column', () => {
      it('should throw an error', () => {
        expect(() => SchemaUtils.getRelation(factories.collectionSchema.build(), 'field')).toThrow(
          MissingRelationError,
        );
      });
    });
  });

  describe('getField', () => {
    describe('when accessing field from relation', () => {
      it('should deny the access', () => {
        expect(() =>
          SchemaUtils.getField(factories.collectionSchema.build(), 'relation:field'),
        ).toThrow(RelationFieldAccessDeniedError);
      });
    });

    describe('when field does not exist', () => {
      it('should throw an error', () => {
        expect(() => SchemaUtils.getField(factories.collectionSchema.build(), 'field')).toThrow(
          MissingFieldError,
        );
      });
    });

    describe('when field exists', () => {
      it('should return fields from column', () => {
        const schema = factories.collectionSchema.build({
          fields: {
            field: factories.columnSchema.build(),
          },
        });

        expect(SchemaUtils.getField(schema, 'field')).toEqual(schema.fields.field);
      });

      it('should return fields from relation', () => {
        const schema = factories.collectionSchema.build({
          fields: {
            relation: factories.manyToManySchema.build(),
          },
        });

        expect(SchemaUtils.getField(schema, 'relation')).toEqual(schema.fields.relation);
      });
    });
  });

  describe('getColumn', () => {
    describe('when accessing field from relation', () => {
      it('should deny the access', () => {
        expect(() =>
          SchemaUtils.getColumn(factories.collectionSchema.build(), 'relation:field'),
        ).toThrow(RelationFieldAccessDeniedError);
      });
    });

    describe('when column does not exist', () => {
      it('should throw an error', () => {
        expect(() => SchemaUtils.getColumn(factories.collectionSchema.build(), 'field')).toThrow(
          MissingColumnError,
        );
      });
    });

    describe('when column exists', () => {
      it('should return the column', () => {
        const schema = factories.collectionSchema.build({
          fields: {
            field: factories.columnSchema.build(),
            relation: factories.manyToManySchema.build(),
          },
        });

        expect(SchemaUtils.getColumn(schema, 'field')).toEqual(schema.fields.field);
      });
    });

    describe('when asking relation', () => {
      it('should throw an error', () => {
        expect(() => SchemaUtils.getColumn(factories.collectionSchema.build(), 'relation')).toThrow(
          MissingColumnError,
        );
      });
    });
  });

  describe('throwIfAlreadyDefinedField', () => {
    describe('when the field is already defined', () => {
      it('should deny the access', () => {
        const schema = factories.collectionSchema.build({
          fields: { field: factories.columnSchema.build() },
        });

        expect(() => SchemaUtils.throwIfAlreadyDefinedField(schema, 'field')).toThrow(
          AlreadyDefinedFieldError,
        );
      });
    });

    describe('when the field is not defined', () => {
      it('should not throw an error', () => {
        const schema = factories.collectionSchema.build({
          fields: {},
        });

        expect(() => SchemaUtils.throwIfAlreadyDefinedField(schema, 'field')).not.toThrow();
      });
    });
  });

  describe('throwIfMissingField', () => {
    describe('when the field is inside a relation', () => {
      it('should deny the access', () => {
        const schema = factories.collectionSchema.build({
          fields: { relation: factories.manyToManySchema.build() },
        });

        expect(() => SchemaUtils.throwIfMissingField(schema, 'relation:field')).toThrow(
          RelationFieldAccessDeniedError,
        );
      });
    });

    describe('when the field is missing', () => {
      it('should throw an error', () => {
        const schema = factories.collectionSchema.build({
          fields: {},
        });

        expect(() => SchemaUtils.throwIfMissingField(schema, 'field')).toThrow(MissingFieldError);
      });
    });

    describe('when the field is defined', () => {
      it('should not throw an error', () => {
        const schema = factories.collectionSchema.build({
          fields: { field: factories.columnSchema.build() },
        });

        expect(() => SchemaUtils.throwIfMissingField(schema, 'field')).not.toThrow();
      });
    });
  });
});
