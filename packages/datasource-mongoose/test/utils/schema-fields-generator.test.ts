import { ColumnSchema, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { Schema, SchemaType, deleteModel, model } from 'mongoose';

import FilterOperatorBuilder from '../../src/utils/filter-operator-builder';
import SchemaFieldsGenerator from '../../src/utils/schema-fields-generator';

const buildModel = schema => {
  try {
    deleteModel('aModel');
    // eslint-disable-next-line no-empty
  } catch {}

  return model('aModel', schema);
};

describe('SchemaFieldsGenerator > buildFieldsSchema', () => {
  describe('when column is not recognized', () => {
    it('should throw an error on simple type', () => {
      const simpleErrorSchema = {
        error: { instance: 'unrecognized', options: {} } as SchemaType,
      };

      expect(() => SchemaFieldsGenerator.buildFieldsSchema(simpleErrorSchema)).toThrow(
        'Unhandled column type "unrecognized"',
      );
    });

    it('should throw an error on array type', () => {
      const arrayErrorSchema = {
        errors: { instance: 'Array', caster: {}, path: 'errors' } as Schema.Types.Array,
      };

      expect(() => SchemaFieldsGenerator.buildFieldsSchema(arrayErrorSchema)).toThrow(
        'Unhandled array column "errors"',
      );
    });
  });

  describe('when field is required', () => {
    it('should build the validation with present operator', () => {
      const schema = new Schema({ aField: { type: Number, required: true } });

      const schemaFields = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema).schema.paths);

      expect((schemaFields.aField as ColumnSchema).validation).toMatchObject([
        { operator: 'Present' },
      ]);
    });
  });

  describe('when field is not required', () => {
    it('should not add a validation', () => {
      const schema = new Schema({ aField: { type: Number, required: false } });

      const schemaFields = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema).schema.paths);

      expect((schemaFields.aField as ColumnSchema).validation).toEqual(null);
    });
  });

  describe('when field have default value', () => {
    it('should build the field schema with a default value', () => {
      const defaultValue = Symbol('default');
      const schema = new Schema({ aField: { type: String, default: defaultValue } });

      const schemaFields = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema).schema.paths);

      expect(schemaFields).toMatchObject({ aField: { defaultValue } });
    });
  });

  describe('when field is the primary key', () => {
    it('should build the field schema with a primary key as true', () => {
      const schema = new Schema({});

      const schemaFields = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema).schema.paths);

      expect(schemaFields).toMatchObject({ _id: { isPrimaryKey: true } });
    });
  });

  describe('when field is immutable', () => {
    it('should build the field schema with a is read only as true', () => {
      const schema = new Schema({ aField: { type: Date, immutable: true } });

      const schemaFields = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema).schema.paths);

      expect(schemaFields).toMatchObject({ aField: { isReadOnly: true } });
    });
  });

  describe('when field have enums', () => {
    it('should build a field schema with a enum column type and enum values', () => {
      const enumValues = [Symbol('enum1'), Symbol('enum2')];
      const schema = new Schema({ aField: { type: String, enum: enumValues } });

      const schemaFields = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema).schema.paths);

      expect(schemaFields).toMatchObject({ aField: { columnType: 'Enum', enumValues } });
    });
  });

  describe('with array fields', () => {
    describe('with primitive array', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cases: Array<[any, PrimitiveTypes]> = [
        [Number, 'Number'],
        [{ type: Number }, 'Number'],
        [Date, 'Date'],
        [{ type: Date }, 'Date'],
        [String, 'String'],
        [{ type: String }, 'String'],
        [Schema.Types.ObjectId, 'String'],
        [{ type: Schema.Types.ObjectId }, 'String'],
        [Buffer, 'String'],
        [{ type: Buffer }, 'String'],
        [Boolean, 'Boolean'],
        [{ type: Boolean }, 'Boolean'],
        [Map, 'Json'],
        [{ type: Map }, 'Json'],
        [Schema.Types.Mixed, 'Json'],
        [{ type: Schema.Types.Mixed }, 'Json'],
      ];
      test.each(cases)('[%p] should build the right column type', (type, expectedType) => {
        const schema = new Schema({ aField: [type] });

        const schemaFields = SchemaFieldsGenerator.buildFieldsSchema(
          buildModel(schema).schema.paths,
        );

        expect(schemaFields).toMatchObject({
          aField: {
            columnType: [expectedType],
            filterOperators: new Set<Operator>(),
            isSortable: false,
            type: 'Column',
          },
        });
      });
    });

    describe('with object array', () => {
      it('should build the right schema', () => {
        const objectSchema = new Schema({ nested: [new Schema({ level: Number })] });

        const schema = new Schema({
          objectArrayField: [{ type: { nested: [{ type: { level: Number } }] } }],
          otherObjectArrayField: [objectSchema],
        });

        const schemaFields = SchemaFieldsGenerator.buildFieldsSchema(
          buildModel(schema).schema.paths,
        );

        expect(schemaFields).toMatchObject({
          objectArrayField: {
            columnType: [{ nested: [{ level: 'Number' }] }],
            filterOperators: new Set<Operator>(),
            isSortable: false,
            type: 'Column',
          },
          otherObjectArrayField: {
            columnType: [{ nested: [{ level: 'Number' }] }],
            filterOperators: new Set<Operator>(),
            isSortable: false,
            type: 'Column',
          },
        });
      });
    });
  });

  describe('with primitive fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cases: Array<[any, PrimitiveTypes, boolean]> = [
      [Number, 'Number', true],
      [{ type: Number }, 'Number', true],
      [Date, 'Date', true],
      [{ type: Date }, 'Date', true],
      [String, 'String', true],
      [{ type: String }, 'String', true],
      [Schema.Types.ObjectId, 'String', true],
      [{ type: Schema.Types.ObjectId }, 'String', true],
      [Buffer, 'String', true],
      [{ type: Buffer }, 'String', true],
      [Boolean, 'Boolean', true],
      [{ type: Boolean }, 'Boolean', true],
      [Map, 'Json', false],
      [{ type: Map }, 'Json', false],
      [Schema.Types.Mixed, 'Json', false],
      [{ type: Schema.Types.Mixed }, 'Json', false],
    ];
    test.each(cases)(
      '[%p] should build the right column type',
      (type, expectedType, expectedIsSortable) => {
        const schema = new Schema({ aField: type });

        const schemaFields = SchemaFieldsGenerator.buildFieldsSchema(
          buildModel(schema).schema.paths,
        );

        expect(schemaFields).toMatchObject({
          aField: {
            columnType: expectedType,
            filterOperators: FilterOperatorBuilder.getSupportedOperators(expectedType),
            isSortable: expectedIsSortable,
            type: 'Column',
          },
        });
      },
    );
  });

  describe('with object field', () => {
    it('should build the right schema', () => {
      const lastObjectSchema = new Schema({
        test: String,
        target: [Number],
        nested: new Schema({ level: Number }),
      });

      const objectSchema = new Schema({
        object: {
          type: {
            nested: {
              type: {
                level: Number,
              },
            },
          },
        },
        anotherObject: {
          nested: {
            level: Number,
          },
        },
        lastObject: lastObjectSchema,
      });

      const objectModel = model('object', objectSchema);
      const schema = SchemaFieldsGenerator.buildFieldsSchema(objectModel.schema.paths);

      expect(schema).toMatchObject({
        object: {
          columnType: {
            nested: {
              level: 'Number',
            },
          },
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Json'),
          isSortable: false,
          type: 'Column',
        },
        anotherObject: {
          columnType: {
            nested: {
              level: 'Number',
            },
          },
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Json'),
          isSortable: false,
          type: 'Column',
        },
        lastObject: {
          columnType: {
            nested: {
              level: 'Number',
            },
          },
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Json'),
          isSortable: false,
          type: 'Column',
        },
      });
    });
  });

  describe('with many to one relationship fields', () => {
    it('should add a relation _manyToOne in the schema fields', () => {
      const schema = new Schema({
        aField: { type: Schema.Types.ObjectId, ref: 'companies' },
      });

      const schemaFields = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema).schema.paths);

      expect(schemaFields).toMatchObject({
        aField_manyToOne: {
          foreignCollection: 'companies',
          foreignKey: 'aField',
          type: 'ManyToOne',
          foreignKeyTarget: '_id',
        },
        aField: {
          type: 'Column',
          columnType: 'String',
          filterOperators: FilterOperatorBuilder.getSupportedOperators('String'),
        },
      });
    });
  });

  describe('with an array of object ids and ref', () => {
    it('should returns a array of string in the schema', () => {
      const schema = new Schema({
        oneToManyField: [{ type: Schema.Types.ObjectId, ref: 'companies1' }],
        anotherOneToManyField: { type: [Schema.Types.ObjectId], ref: 'companies2' },
      });

      const schemaFields = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema).schema.paths);

      expect(schemaFields).toMatchObject({
        oneToManyField: {
          columnType: ['String'],
          type: 'Column',
        },
        anotherOneToManyField: {
          columnType: ['String'],
          type: 'Column',
        },
      });
    });
  });
});
