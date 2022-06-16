import { ColumnSchema, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { Schema } from 'mongoose';

import { buildModel } from '../../_helpers';
import FieldsGenerator from '../../../src/utils/schema/fields';
import FilterOperatorsGenerator from '../../../src/utils/schema/filter-operators';

const defaultValues = {
  defaultValue: undefined,
  enumValues: undefined,
  isPrimaryKey: false,
  isReadOnly: false,
  validation: null,
};

describe('SchemaFieldsGenerator', () => {
  describe('buildFieldsSchema', () => {
    describe('when field is required', () => {
      it('should build the validation with present operator', () => {
        const schema = new Schema({ aField: { type: Number, required: true } });

        const fieldsSchema = FieldsGenerator.buildFieldsSchema(buildModel(schema));

        expect((fieldsSchema.aField as ColumnSchema).validation).toMatchObject([
          { operator: 'Present' },
        ]);
      });
    });

    describe('when field is not required', () => {
      it('should not add a validation', () => {
        const schema = new Schema({ aField: { type: Number, required: false } });

        const fieldsSchema = FieldsGenerator.buildFieldsSchema(buildModel(schema));

        expect((fieldsSchema.aField as ColumnSchema).validation).toEqual(null);
      });
    });

    describe('when field have default value', () => {
      it('should build the field schema with a default value', () => {
        const defaultValue = Symbol('default');
        const schema = new Schema({ aField: { type: String, default: defaultValue } });

        const fieldsSchema = FieldsGenerator.buildFieldsSchema(buildModel(schema));

        expect(fieldsSchema).toMatchObject({ aField: { defaultValue } });
      });
    });

    describe('when field is the primary key', () => {
      it('should build the field schema with a primary key as true', () => {
        const schema = new Schema({});

        const fieldsSchema = FieldsGenerator.buildFieldsSchema(buildModel(schema));

        expect(fieldsSchema).toMatchObject({ _id: { isPrimaryKey: true } });
      });
    });

    describe('when field is immutable', () => {
      it('should build the field schema with a is read only as true', () => {
        const schema = new Schema({ aField: { type: Date, immutable: true } });

        const fieldsSchema = FieldsGenerator.buildFieldsSchema(buildModel(schema));

        expect(fieldsSchema).toMatchObject({ aField: { isReadOnly: true } });
      });
    });

    describe('when field have enums', () => {
      it('should build a field schema with a enum column type and enum values', () => {
        const enumValues = ['enum1', 'enum2'];
        const schema = new Schema({ aField: { type: String, enum: enumValues } });

        const fieldsSchema = FieldsGenerator.buildFieldsSchema(buildModel(schema));

        expect(fieldsSchema).toMatchObject({ aField: { columnType: 'Enum', enumValues } });
      });

      describe('when it is declared with an other syntax', () => {
        it('should build a field schema with a enum column type and enum values', () => {
          const enumValues = ['enum1', 'enum2'];
          const schema = new Schema({
            aField: {
              type: String,
              enum: {
                values: enumValues,
                message: '{VALUE} is not supported',
              },
            },
          });

          const fieldsSchema = FieldsGenerator.buildFieldsSchema(buildModel(schema));

          expect(fieldsSchema).toMatchObject({ aField: { columnType: 'Enum', enumValues } });
        });
      });

      describe('when the enum is not a array of string', () => {
        it('should raise an error', () => {
          const enumValues = [1, 2];
          const schema = new Schema({ aField: { type: Number, enum: enumValues } });

          const fieldsSchema = FieldsGenerator.buildFieldsSchema(buildModel(schema));

          expect(fieldsSchema).toMatchObject({ aField: { columnType: 'Number' } });
        });
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
          [Schema.Types.Decimal128, 'String'],
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

          const fieldsSchema = FieldsGenerator.buildFieldsSchema(buildModel(schema));

          expect(fieldsSchema).toMatchObject({
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

          const fieldsSchema = FieldsGenerator.buildFieldsSchema(buildModel(schema));

          expect(fieldsSchema.objectArrayField).toEqual({
            columnType: [{ nested: [{ level: 'Number' }] }],
            filterOperators: new Set<Operator>(),
            isSortable: false,
            type: 'Column',
            ...defaultValues,
          });
          expect(fieldsSchema.otherObjectArrayField).toEqual({
            columnType: [{ nested: [{ level: 'Number' }] }],
            filterOperators: new Set<Operator>(),
            isSortable: false,
            type: 'Column',
            ...defaultValues,
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

          const fieldsSchema = FieldsGenerator.buildFieldsSchema(buildModel(schema));

          expect(fieldsSchema).toMatchObject({
            aField: {
              columnType: expectedType,
              filterOperators: FilterOperatorsGenerator.getSupportedOperators(expectedType),
              isSortable: expectedIsSortable,
              type: 'Column',
            },
          });
        },
      );
    });

    describe('with nested path and sub document', () => {
      it('should build the right column type and remove the _id in the nested fields', () => {
        const objectSchema = new Schema({
          object: { type: { nested: { type: { level: Number } } } },
          anotherObject: { nested: { level: Number } },
          lastObject: new Schema({
            test: String,
            target: [Number],
            nested: new Schema({ level: Number }),
          }),
        });

        const schema = FieldsGenerator.buildFieldsSchema(buildModel(objectSchema, 'object'));

        expect(schema.object).toEqual({
          columnType: { nested: { level: 'Number' } },
          filterOperators: FilterOperatorsGenerator.getSupportedOperators('Json'),
          isSortable: false,
          type: 'Column',
          ...defaultValues,
        });

        expect(schema.anotherObject).toEqual({
          columnType: { nested: { level: 'Number' } },
          filterOperators: FilterOperatorsGenerator.getSupportedOperators('Json'),
          isSortable: false,
          type: 'Column',
          ...defaultValues,
        });

        expect(schema.lastObject).toEqual({
          columnType: { nested: { level: 'Number' }, target: ['Number'], test: 'String' },
          filterOperators: FilterOperatorsGenerator.getSupportedOperators('Json'),
          isSortable: false,
          type: 'Column',
          ...defaultValues,
        });
      });

      describe('with a very deep object of sub document and nested path', () => {
        it('should build the right column type', () => {
          const objectSchema = new Schema({
            object: {
              type: {
                nested: {
                  nested2: {
                    type: {
                      level: Number,
                    },
                  },
                },
              },
            },
          });

          const schema = FieldsGenerator.buildFieldsSchema(buildModel(objectSchema, 'object'));

          expect(schema.object).toEqual({
            columnType: {
              nested: {
                nested2: {
                  level: 'Number',
                },
              },
            },
            filterOperators: FilterOperatorsGenerator.getSupportedOperators('Json'),
            isSortable: false,
            type: 'Column',
            ...defaultValues,
          });
        });
      });
    });

    describe('with an objectId and a ref', () => {
      it('should add a relation _manyToOne in the fields schema', () => {
        const schema = new Schema({
          aField: { type: Schema.Types.ObjectId, ref: 'companies' },
        });

        const fieldsSchema = FieldsGenerator.buildFieldsSchema(buildModel(schema, 'aModel'));

        expect(fieldsSchema).toMatchObject({
          aField__manyToOne: {
            foreignCollection: 'companies',
            foreignKey: 'aField',
            type: 'ManyToOne',
            foreignKeyTarget: '_id',
          },
          aField: {
            type: 'Column',
            columnType: 'String',
            filterOperators: FilterOperatorsGenerator.getSupportedOperators('String'),
          },
        });
      });
    });

    describe('with an array of objectId and a ref', () => {
      it('should returns a array of string in the schema', () => {
        const schema = new Schema({
          manyToManyField: { type: [Schema.Types.ObjectId], ref: 'companies' },
        });

        const fieldsSchema = FieldsGenerator.buildFieldsSchema(buildModel(schema, 'aModelName'));

        expect(fieldsSchema).toMatchObject({
          manyToManyField: { type: 'Column', columnType: ['String'] },
        });
      });
    });
  });
});
