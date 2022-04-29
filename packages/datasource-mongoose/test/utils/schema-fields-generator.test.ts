import { Operator } from '@forestadmin/datasource-toolkit';
import { Schema, SchemaType, model } from 'mongoose';

import FilterOperatorBuilder from '../../src/utils/filter-operator-builder';
import SchemaFieldsGenerator from '../../src/utils/schema-fields-generator';

describe('MongooseCollection', () => {
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
      const defaultSchema = new Schema({ aField: { type: String, default: defaultValue } });

      const defaultModel = model('aModel', defaultSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(defaultModel.schema.paths);

      expect(schema).toMatchObject({ aField: { defaultValue } });
    });
  });

  describe('when field is the primary key', () => {
    it('should build the field schema with a primary key as true', () => {
      const idSchema = new Schema({});

      const idModel = model('aModel', idSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(idModel.schema.paths);

      expect(schema).toMatchObject({ _id: { isPrimaryKey: true } });
    });
  });

  describe('when field is immutable', () => {
    it('should build the field schema with a is read only as true', () => {
      const immutableSchema = new Schema({ aField: { type: Date, immutable: true } });

      const immutableModel = model('adModel', immutableSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(immutableModel.schema.paths);

      expect(schema).toMatchObject({ aField: { isReadOnly: true } });
    });
  });

  describe('when field have enums', () => {
    it('should build a field schema with a enum column type and enum values', () => {
      const enumValues = [Symbol('enum1'), Symbol('enum2')];
      const enumSchema = new Schema({ aField: { type: String, enum: enumValues } });

      const enumModel = model('aModel', enumSchema);
      const schema = SchemaFieldsGenerator.buildSchemaFields(enumModel.schema.paths);

      expect(schema).toMatchObject({ aField: { columnType: 'Enum', enumValues } });
    });
  });

  //-----------------------------------------------
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
