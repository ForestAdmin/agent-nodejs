import { Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
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

describe('SchemaFieldsGenerator', () => {
  describe('when column is not recognized', () => {
    it('should throw an error on simple type', () => {
      const simpleErrorSchema = {
        error: { instance: 'unrecognized', options: {} } as SchemaType,
      };

      expect(() => SchemaFieldsGenerator.buildSchemaFields(simpleErrorSchema)).toThrow(
        'Unhandled column type "unrecognized"',
      );
    });

    it('should throw an error on array type', () => {
      const arrayErrorSchema = {
        errors: { instance: 'Array', caster: {}, path: 'errors' } as Schema.Types.Array,
      };

      expect(() => SchemaFieldsGenerator.buildSchemaFields(arrayErrorSchema)).toThrow(
        'Unhandled array column "errors"',
      );
    });
  });

  describe('when field is required', () => {
    it('should build the field schema with a required as true', () => {
      const requiredSchema = new Schema({ aField: { type: Number, required: true } });

      const requiredModel = model('aModel', requiredSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(requiredModel.schema.paths);

      expect(schema).toMatchObject({ aField: { isRequired: true } });
    });
  });

  describe('when field have default value', () => {
    it('should build the field schema with a default value', () => {
      const defaultValue = Symbol('default');
      const schema = new Schema({ aField: { type: String, default: defaultValue } });

      const schemaFields = SchemaFieldsGenerator.buildSchemaFields(buildModel(schema).schema.paths);

      expect(schemaFields).toMatchObject({ aField: { defaultValue } });
    });
  });

  describe('when field is the primary key', () => {
    it('should build the field schema with a primary key as true', () => {
      const schema = new Schema({});

      const schemaFields = SchemaFieldsGenerator.buildSchemaFields(buildModel(schema).schema.paths);

      expect(schemaFields).toMatchObject({ _id: { isPrimaryKey: true } });
    });
  });

  describe('when field is immutable', () => {
    it('should build the field schema with a is read only as true', () => {
      const schema = new Schema({ aField: { type: Date, immutable: true } });

      const schemaFields = SchemaFieldsGenerator.buildSchemaFields(buildModel(schema).schema.paths);

      expect(schemaFields).toMatchObject({ aField: { isReadOnly: true } });
    });
  });

  describe('when field have enums', () => {
    it('should build a field schema with a enum column type and enum values', () => {
      const enumValues = [Symbol('enum1'), Symbol('enum2')];
      const schema = new Schema({ aField: { type: String, enum: enumValues } });

      const schemaFields = SchemaFieldsGenerator.buildSchemaFields(buildModel(schema).schema.paths);

      expect(schemaFields).toMatchObject({ aField: { columnType: 'Enum', enumValues } });
    });
  });

  describe('with array fields', () => {
    describe('with primitive array', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const types: Array<[any, PrimitiveTypes]> = [
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
      test.each(types)('[%s] should build the right column type', (type, expectedType) => {
        const schema = new Schema({ aField: [type] });

        const schemaFields = SchemaFieldsGenerator.buildSchemaFields(
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

        const schemaFields = SchemaFieldsGenerator.buildSchemaFields(
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
    const types: Array<[any, PrimitiveTypes, boolean]> = [
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
    test.each(types)(
      '[%p] should build the right column type',
      (type, expectedType, expectedIsSortable) => {
        const schema = new Schema({ aField: type });

        const schemaFields = SchemaFieldsGenerator.buildSchemaFields(
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
      const schema = SchemaFieldsGenerator.buildSchemaFields(objectModel.schema.paths);

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

  //-----------------------------------------------

  describe('with belongsTo relationship fields', () => {
    it('should build the right schema', () => {
      const belongsToSchema = new Schema(
        {
          belongsTo: { type: Schema.Types.ObjectId, ref: 'companies' },
        },
        { _id: false },
      );

      const belongsToModel = model('belongsTo', belongsToSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(belongsToModel.schema.paths);

      expect(schema).toStrictEqual({
        belongsTo_manyToOne: {
          foreignCollection: 'companies',
          foreignKey: 'belongsTo',
          type: 'ManyToOne',
        },
        belongsTo: {
          columnType: 'String',
          filterOperators: FilterOperatorBuilder.getSupportedOperators('String'),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: true,
          type: 'Column',
        },
      });
    });
  });

  describe('with hasMany relationship fields', () => {
    it('should build the right schema', () => {
      const hasManySchema = new Schema(
        {
          hasMany: [{ type: Schema.Types.ObjectId, ref: 'companies1' }],
          anotherHasMany: { type: [Schema.Types.ObjectId], ref: 'companies2' },
        },
        { _id: false },
      );

      const hasManyModel = model('hasMany', hasManySchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(hasManyModel.schema.paths);

      expect(schema).toStrictEqual({
        hasMany_oneToMany: {
          foreignCollection: 'companies1',
          foreignKey: 'hasMany',
          type: 'OneToMany',
        },
        hasMany: {
          columnType: ['String'],
          filterOperators: new Set<Operator>(),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: false,
          type: 'Column',
        },
        anotherHasMany_oneToMany: {
          foreignCollection: 'companies2',
          foreignKey: 'anotherHasMany',
          type: 'OneToMany',
        },
        anotherHasMany: {
          columnType: ['String'],
          filterOperators: new Set<Operator>(),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: false,
          type: 'Column',
        },
      });
    });
  });
});
