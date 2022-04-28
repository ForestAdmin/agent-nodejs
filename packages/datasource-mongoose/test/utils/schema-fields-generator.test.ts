import { Operator } from '@forestadmin/datasource-toolkit';
import { Schema, SchemaType, model } from 'mongoose';

import FilterOperatorBuilder from '../../src/utils/filter-operator-builder';
import SchemaFieldsGenerator from '../../src/utils/schema-fields-generator';

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
            columnType: ['Number'],
            filterOperators: new Set<Operator>(),
            defaultValue: undefined,
            enumValues: undefined,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            isSortable: false,
            type: 'Column',
          },
          anotherPrimitiveArray: {
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
          lastPrimitiveArray: {
            columnType: ['Date'],
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
                test: 'String',
                target: ['Number'],
                nested: [
                  {
                    level: 'Number',
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
            type: 'Column',
          },
          anotherObjectArray: {
            columnType: [
              {
                test: 'String',
                target: ['Number'],
                nested: [
                  {
                    level: 'Number',
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
            type: 'Column',
          },
          lastObjectArray: {
            columnType: [
              {
                test: 'String',
                target: ['Number'],
                nested: [
                  {
                    level: 'Number',
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
            type: 'Column',
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
        anotherPrimitive: {
          columnType: 'Boolean',
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Boolean'),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: true,
          type: 'Column',
        },
        buffer: {
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
        map: {
          columnType: 'Json',
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Json'),
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
            test: 'String',
            target: ['Number'],
            nested: {
              level: 'Number',
            },
          },
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Json'),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: false,
          type: 'Column',
        },
        anotherObject: {
          columnType: {
            test: 'String',
            target: ['Number'],
            nested: {
              level: 'Number',
            },
          },
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Json'),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: false,
          type: 'Column',
        },
        lastObject: {
          columnType: {
            test: 'String',
            target: ['Number'],
            nested: {
              level: 'Number',
            },
          },
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Json'),
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
          columnType: 'Enum',
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Enum'),
          defaultValue: undefined,
          enumValues,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          isSortable: true,
          type: 'Column',
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
          columnType: 'String',
          filterOperators: FilterOperatorBuilder.getSupportedOperators('String'),
          defaultValue,
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

  describe('when field is the primary key', () => {
    it('should build the right schema', () => {
      const idSchema = new Schema({});

      const idModel = model('id', idSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(idModel.schema.paths);

      expect(schema).toStrictEqual({
        _id: {
          columnType: 'String',
          filterOperators: FilterOperatorBuilder.getSupportedOperators('String'),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: true,
          isReadOnly: false,
          isRequired: false,
          isSortable: true,
          type: 'Column',
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
          columnType: 'Number',
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Number'),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: true,
          isSortable: true,
          type: 'Column',
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
          columnType: 'Date',
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Date'),
          defaultValue: undefined,
          enumValues: undefined,
          isPrimaryKey: false,
          isReadOnly: true,
          isRequired: false,
          isSortable: true,
          type: 'Column',
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

    it('should throw an error on array type', () => {
      const arrayErrorSchema = {
        errors: { instance: 'Array', caster: {}, path: 'errors' } as Schema.Types.Array,
      };

      expect(() => SchemaFieldsGenerator.buildSchemaFields(arrayErrorSchema)).toThrow(
        'Unhandled array column "errors"',
      );
    });
  });
});
