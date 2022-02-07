import { FieldTypes, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { Schema, model, SchemaType } from 'mongoose';

import SchemaFieldsGenerator from '../../src/utils/schema-fields-generator';
import FilterOperatorBuilder from '../../src/utils/filter-operator-builder';

describe('MongooseCollection', () => {
  describe('with array fields', () => {
    describe('with primitive array', () => {
      it('should build the right schema', () => {
        const primitiveArraySchema = new Schema(
          {
            primitiveArray: [Number],
            anotherPrimitiveArray: [{ type: String }],
            lastPrimitiveArray: { type: [Date] },
          },
          { _id: false },
        );

        const primitiveArrayModel = model('primitiveArray', primitiveArraySchema);
        const schema = SchemaFieldsGenerator.buildSchemaFields(primitiveArrayModel.schema.paths);

        expect(schema).toStrictEqual({
          primitiveArray: {
            columnType: [PrimitiveTypes.Number],
            filterOperators: new Set<Operator>(),
            defaultValue: undefined,
            enumValues: undefined,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            isSortable: false,
            type: FieldTypes.Column,
          },
          anotherPrimitiveArray: {
            columnType: [PrimitiveTypes.String],
            filterOperators: new Set<Operator>(),
            defaultValue: undefined,
            enumValues: undefined,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            isSortable: false,
            type: FieldTypes.Column,
          },
          lastPrimitiveArray: {
            columnType: [PrimitiveTypes.Date],
            filterOperators: new Set<Operator>(),
            defaultValue: undefined,
            enumValues: undefined,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            isSortable: false,
            type: FieldTypes.Column,
          },
        });
      });
    });

    describe('with an array of ObjectId', () => {
      it('should build the right schema', () => {
        const objectIdArraySchema = new Schema(
          {
            objectIdArray: [Schema.Types.ObjectId],
          },
          { _id: false },
        );

        const objectIdArrayModel = model('objectIdArray', objectIdArraySchema);
        const schema = SchemaFieldsGenerator.buildSchemaFields(objectIdArrayModel.schema.paths);

        expect(schema).toStrictEqual({
          objectIdArray: {
            columnType: [PrimitiveTypes.String],
            filterOperators: new Set<Operator>(),
            defaultValue: undefined,
            enumValues: undefined,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            isSortable: false,
            type: FieldTypes.Column,
          },
        });
      });
    });

    describe('with object array', () => {
      it('should build the right schema', () => {
        const nestedSchema = new Schema({ level: Number }, { _id: false });
        const objectSchema = new Schema(
          {
            test: String,
            target: [Number],
            nested: [nestedSchema],
          },
          { _id: false },
        );

        const objectArraySchema = new Schema(
          {
            objectArray: [
              {
                test: String,
                target: [Number],
                nested: [
                  {
                    level: Number,
                  },
                ],
              },
            ],
            anotherObjectArray: [
              {
                type: {
                  test: String,
                  target: [Number],
                  nested: [
                    {
                      type: {
                        level: Number,
                        _id: false,
                      },
                    },
                  ],
                },
              },
            ],
            lastObjectArray: [objectSchema],
          },
          { _id: false },
        );

        const objectArrayModel = model('objectArray', objectArraySchema);
        const schema = SchemaFieldsGenerator.buildSchemaFields(objectArrayModel.schema.paths);

        expect(schema).toStrictEqual({
          objectArray: {
            columnType: [
              {
                test: PrimitiveTypes.String,
                target: [PrimitiveTypes.Number],
                nested: [
                  {
                    level: PrimitiveTypes.Number,
                  },
                ],
              },
            ],
            filterOperators: new Set<Operator>(),
            defaultValue: undefined,
            enumValues: undefined,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            isSortable: false,
            type: FieldTypes.Column,
          },
          anotherObjectArray: {
            columnType: [
              {
                test: PrimitiveTypes.String,
                target: [PrimitiveTypes.Number],
                nested: [
                  {
                    level: PrimitiveTypes.Number,
                  },
                ],
              },
            ],
            filterOperators: new Set<Operator>(),
            defaultValue: undefined,
            enumValues: undefined,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            isSortable: false,
            type: FieldTypes.Column,
          },
          lastObjectArray: {
            columnType: [
              {
                test: PrimitiveTypes.String,
                target: [PrimitiveTypes.Number],
                nested: [
                  {
                    level: PrimitiveTypes.Number,
                  },
                ],
              },
            ],
            filterOperators: new Set<Operator>(),
            defaultValue: undefined,
            enumValues: undefined,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            isSortable: false,
            type: FieldTypes.Column,
          },
        });
      });
    });
  });

  describe('with primitive fields', () => {
    it('should build the right schema', () => {
      const primitiveSchema = new Schema(
        {
          primitive: String,
          anotherPrimitive: { type: Boolean },
          buffer: Schema.Types.Buffer,
          map: Schema.Types.Map,
        },
        { _id: false },
      );

      const primitiveModel = model('primitive', primitiveSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(primitiveModel.schema.paths);

      expect(schema).toStrictEqual({
        primitive: {
          columnType: PrimitiveTypes.String,
          filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.String),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: true,
          type: FieldTypes.Column,
        },
        anotherPrimitive: {
          columnType: PrimitiveTypes.Boolean,
          filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.Boolean),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: true,
          type: FieldTypes.Column,
        },
        buffer: {
          columnType: PrimitiveTypes.String,
          filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.String),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: true,
          type: FieldTypes.Column,
        },
        map: {
          columnType: PrimitiveTypes.Json,
          filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.Json),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: false,
          type: FieldTypes.Column,
        },
      });
    });

    describe('with field of type ObjectId', () => {
      it('should build the right schema', () => {
        const objectIdSchema = new Schema(
          {
            objectId: Schema.Types.ObjectId,
          },
          { _id: false },
        );

        const objectIdModel = model('objectId', objectIdSchema);
        const schema = SchemaFieldsGenerator.buildSchemaFields(objectIdModel.schema.paths);

        expect(schema).toStrictEqual({
          objectId: {
            columnType: PrimitiveTypes.String,
            filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.String),
            defaultValue: undefined,
            enumValues: undefined,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            isSortable: true,
            type: FieldTypes.Column,
          },
        });
      });
    });
  });

  describe('with object field', () => {
    it('should build the right schema', () => {
      const nestedSchema = new Schema({ level: Number }, { _id: false });
      const lastObjectSchema = new Schema(
        {
          test: String,
          target: [Number],
          nested: nestedSchema,
        },
        { _id: false },
      );

      const objectSchema = new Schema(
        {
          object: {
            type: {
              test: String,
              target: [Number],
              nested: {
                type: {
                  level: Number,
                  _id: false,
                },
              },
              _id: false,
            },
          },
          anotherObject: {
            test: String,
            target: [Number],
            nested: {
              level: Number,
            },
          },
          lastObject: lastObjectSchema,
        },
        { _id: false },
      );

      const objectModel = model('object', objectSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(objectModel.schema.paths);

      expect(schema).toStrictEqual({
        object: {
          columnType: {
            test: PrimitiveTypes.String,
            target: [PrimitiveTypes.Number],
            nested: {
              level: PrimitiveTypes.Number,
            },
          },
          filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.Json),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: false,
          type: FieldTypes.Column,
        },
        anotherObject: {
          columnType: {
            test: PrimitiveTypes.String,
            target: [PrimitiveTypes.Number],
            nested: {
              level: PrimitiveTypes.Number,
            },
          },
          filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.Json),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: false,
          type: FieldTypes.Column,
        },
        lastObject: {
          columnType: {
            test: PrimitiveTypes.String,
            target: [PrimitiveTypes.Number],
            nested: {
              level: PrimitiveTypes.Number,
            },
          },
          filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.Json),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: false,
          type: FieldTypes.Column,
        },
      });
    });
  });

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
          type: FieldTypes.ManyToOne,
        },
        belongsTo: {
          columnType: PrimitiveTypes.String,
          filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.String),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: true,
          type: FieldTypes.Column,
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
          type: FieldTypes.OneToMany,
        },
        hasMany: {
          columnType: [PrimitiveTypes.String],
          filterOperators: new Set<Operator>(),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: false,
          type: FieldTypes.Column,
        },
        anotherHasMany_oneToMany: {
          foreignCollection: 'companies2',
          foreignKey: 'anotherHasMany',
          type: FieldTypes.OneToMany,
        },
        anotherHasMany: {
          columnType: [PrimitiveTypes.String],
          filterOperators: new Set<Operator>(),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: false,
          type: FieldTypes.Column,
        },
      });
    });
  });

  describe('when field have enums', () => {
    it('should build the right schema', () => {
      const enumValues = [Symbol('enum1'), Symbol('enum2')];
      const enumSchema = new Schema(
        {
          enum: { type: String, enum: enumValues },
        },
        { _id: false },
      );

      const enumModel = model('enum', enumSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(enumModel.schema.paths);

      expect(schema).toStrictEqual({
        enum: {
          columnType: PrimitiveTypes.Enum,
          filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.Enum),
          defaultValue: undefined,
          enumValues,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: true,
          type: FieldTypes.Column,
        },
      });
    });
  });

  describe('when field have default value', () => {
    it('should build the right schema', () => {
      const defaultValue = Symbol('default');
      const defaultSchema = new Schema(
        {
          default: { type: String, default: defaultValue },
        },
        { _id: false },
      );

      const defaultModel = model('default', defaultSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(defaultModel.schema.paths);

      expect(schema).toStrictEqual({
        default: {
          columnType: PrimitiveTypes.String,
          filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.String),
          defaultValue,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: true,
          type: FieldTypes.Column,
        },
      });
    });
  });

  describe('when field is the primary key', () => {
    it('should build the right schema', () => {
      const idSchema = new Schema({});

      const idModel = model('id', idSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(idModel.schema.paths);

      expect(schema).toStrictEqual({
        _id: {
          columnType: PrimitiveTypes.String,
          filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.String),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: true,
          isReadOnly: false,
          isRequired: false,
          isSortable: true,
          type: FieldTypes.Column,
        },
      });
    });
  });

  describe('when field is required', () => {
    it('should build the right schema', () => {
      const requiredSchema = new Schema(
        {
          required: { type: Number, required: true },
        },
        { _id: false },
      );

      const requiredModel = model('required', requiredSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(requiredModel.schema.paths);

      expect(schema).toStrictEqual({
        required: {
          columnType: PrimitiveTypes.Number,
          filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.Number),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: true,
          isSortable: true,
          type: FieldTypes.Column,
        },
      });
    });
  });

  describe('when field is immutable', () => {
    it('should build the right schema', () => {
      const immutableSchema = new Schema(
        {
          immutable: { type: Date, immutable: true },
        },
        { _id: false },
      );

      const immutableModel = model('immutable', immutableSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(immutableModel.schema.paths);

      expect(schema).toStrictEqual({
        immutable: {
          columnType: PrimitiveTypes.Date,
          filterOperators: FilterOperatorBuilder.getSupportedOperators(PrimitiveTypes.Date),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: true,
          isRequired: false,
          isSortable: true,
          type: FieldTypes.Column,
        },
      });
    });
  });

  describe('when column is not recognized', () => {
    it('should throw an error on simple type', () => {
      const simpleErrorSchema = {
        error: { instance: 'unrecognized', options: {} } as SchemaType,
      };

      expect(() => SchemaFieldsGenerator.buildSchemaFields(simpleErrorSchema)).toThrow(
        'Unhandled column type "unrecognized"',
      );
    });

    it('should throw an error on simple type', () => {
      const arrayErrorSchema = {
        errors: { instance: 'Array', caster: {}, path: 'errors' } as Schema.Types.Array,
      };

      expect(() => SchemaFieldsGenerator.buildSchemaFields(arrayErrorSchema)).toThrow(
        'Unhandled array column "errors"',
      );
    });
  });
});
