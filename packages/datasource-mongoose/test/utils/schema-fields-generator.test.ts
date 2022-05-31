import {
  ColumnSchema,
  Operator,
  PrimitiveTypes,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Connection, Model, Schema, deleteModel, model } from 'mongoose';

import FilterOperatorBuilder from '../../src/utils/filter-operator-builder';
import MongooseCollection from '../../src/collections/collection';
import MongooseDatasource from '../../src/datasource';
import SchemaFieldsGenerator from '../../src/utils/schema-fields-generator';

const buildModel = (schema: Schema, modelName = 'aModel'): Model<RecordData> => {
  try {
    deleteModel(modelName);
    // eslint-disable-next-line no-empty
  } catch {}

  return model(modelName, schema);
};

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

        const fieldsSchema = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema));

        expect((fieldsSchema.aField as ColumnSchema).validation).toMatchObject([
          { operator: 'Present' },
        ]);
      });
    });

    describe('when field is not required', () => {
      it('should not add a validation', () => {
        const schema = new Schema({ aField: { type: Number, required: false } });

        const fieldsSchema = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema));

        expect((fieldsSchema.aField as ColumnSchema).validation).toEqual(null);
      });
    });

    describe('when field have default value', () => {
      it('should build the field schema with a default value', () => {
        const defaultValue = Symbol('default');
        const schema = new Schema({ aField: { type: String, default: defaultValue } });

        const fieldsSchema = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema));

        expect(fieldsSchema).toMatchObject({ aField: { defaultValue } });
      });
    });

    describe('when field is the primary key', () => {
      it('should build the field schema with a primary key as true', () => {
        const schema = new Schema({});

        const fieldsSchema = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema));

        expect(fieldsSchema).toMatchObject({ _id: { isPrimaryKey: true } });
      });
    });

    describe('when field is immutable', () => {
      it('should build the field schema with a is read only as true', () => {
        const schema = new Schema({ aField: { type: Date, immutable: true } });

        const fieldsSchema = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema));

        expect(fieldsSchema).toMatchObject({ aField: { isReadOnly: true } });
      });
    });

    describe('when field have enums', () => {
      it('should build a field schema with a enum column type and enum values', () => {
        const enumValues = ['enum1', 'enum2'];
        const schema = new Schema({ aField: { type: String, enum: enumValues } });

        const fieldsSchema = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema));

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

          const fieldsSchema = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema));

          expect(fieldsSchema).toMatchObject({ aField: { columnType: 'Enum', enumValues } });
        });
      });

      describe('when the enum is not a array of string', () => {
        it('should raise an error', () => {
          const enumValues = [1, 2];
          const schema = new Schema({ aField: { type: String, enum: enumValues } });

          expect(() => SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema))).toThrow(
            'Enum support only String values',
          );
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

          const fieldsSchema = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema));

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

          const fieldsSchema = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema));

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

          const fieldsSchema = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema));

          expect(fieldsSchema).toMatchObject({
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

    describe('with nested path and sub document', () => {
      it('should build the right column type and remove the _id in the nested fields', () => {
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

        const schema = SchemaFieldsGenerator.buildFieldsSchema(buildModel(objectSchema, 'object'));

        expect(schema.object).toEqual({
          columnType: {
            nested: {
              level: 'Number',
            },
          },
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Json'),
          isSortable: false,
          type: 'Column',
          ...defaultValues,
        });

        expect(schema.anotherObject).toEqual({
          columnType: {
            nested: {
              level: 'Number',
            },
          },
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Json'),
          isSortable: false,
          type: 'Column',
          ...defaultValues,
        });

        expect(schema.lastObject).toEqual({
          columnType: {
            nested: {
              level: 'Number',
            },
          },
          filterOperators: FilterOperatorBuilder.getSupportedOperators('Json'),
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

          const schema = SchemaFieldsGenerator.buildFieldsSchema(
            buildModel(objectSchema, 'object'),
          );

          expect(schema.object).toEqual({
            columnType: {
              nested: {
                nested2: {
                  level: 'Number',
                },
              },
            },
            filterOperators: FilterOperatorBuilder.getSupportedOperators('Json'),
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

        const fieldsSchema = SchemaFieldsGenerator.buildFieldsSchema(buildModel(schema, 'aModel'));

        expect(fieldsSchema).toMatchObject({
          aField__aModel__manyToOne: {
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

    describe('with an array of objectId and a ref', () => {
      it('should returns a array of string in the schema', () => {
        const schema = new Schema({
          manyToManyField: { type: [Schema.Types.ObjectId], ref: 'companies' },
        });

        const fieldsSchema = SchemaFieldsGenerator.buildFieldsSchema(
          buildModel(schema, 'aModelName'),
        );

        expect(fieldsSchema).toMatchObject({
          manyToManyField__aModelName__manyToOne: {
            type: 'ManyToMany',
            foreignCollection: 'companies',
            throughCollection: 'aModelName__companies__manyToManyField',
            foreignKey: 'companies_id',
            foreignKeyTarget: '_id',
            originKey: 'aModelName_id',
            originKeyTarget: '_id',
          },
        });
      });
    });
  });

  describe('addInverseRelationships', () => {
    describe('when there is a many to one relation', () => {
      it('should add a relation _oneToMany in the referenced model', () => {
        // given
        const schemaWithManyToOne = new Schema({
          aFieldRelation: { type: Schema.Types.ObjectId, ref: 'modelB' },
        });
        const schemaWithOneToMany = new Schema({ aField: { type: 'String' } });

        const dataSource = new MongooseDatasource({ models: {} } as Connection);
        const modelA = buildModel(schemaWithManyToOne, 'modelA');
        const modelB = buildModel(schemaWithOneToMany, 'modelB');
        const collectionA = new MongooseCollection(dataSource, modelA);
        const collectionB = new MongooseCollection(dataSource, modelB);

        // when
        dataSource.addCollection(collectionB);
        dataSource.addCollection(collectionA, true);

        // then
        expect(collectionB.schema.fields).toMatchObject({
          modelB__aFieldRelation__oneToMany: {
            foreignCollection: 'modelA',
            originKeyTarget: '_id',
            originKey: 'aFieldRelation',
            type: 'OneToMany',
          },
          aField: {
            type: 'Column',
            columnType: 'String',
            filterOperators: FilterOperatorBuilder.getSupportedOperators('String'),
          },
        });
      });
    });

    describe('when there is a many to many relation', () => {
      it('adds a _ManyToMany relation to the references model and create a new collection', () => {
        // given
        const schemaWithManyToMany = new Schema({
          aFieldRelation: { type: [Schema.Types.ObjectId], ref: 'modelB' },
        });
        const referencedSchema = new Schema();

        const modelA = buildModel(schemaWithManyToMany, 'modelA');
        const modelB = buildModel(referencedSchema, 'modelB');
        const dataSource = new MongooseDatasource({ models: {} } as Connection);

        const collectionA = new MongooseCollection(dataSource, modelA);
        const collectionB = new MongooseCollection(dataSource, modelB);

        // when
        dataSource.addCollection(collectionB);
        dataSource.addCollection(collectionA, true);

        // then
        expect(collectionB.schema.fields.modelB__modelA_id__aFieldRelation).toEqual({
          type: 'ManyToMany',
          foreignCollection: 'modelA',
          throughCollection: 'modelA__modelB__aFieldRelation',
          foreignKey: 'modelA_id',
          foreignKeyTarget: '_id',
          originKey: 'modelB_id',
          originKeyTarget: '_id',
        });

        // be aware to not create two times the collection
        expect(() => dataSource.getCollection('modelB__modelA__aFieldRelation')).toThrow();
        const manyToManyCollection = dataSource.getCollection('modelA__modelB__aFieldRelation');

        expect(manyToManyCollection.schema.fields.modelA_id).toHaveProperty('isPrimaryKey', true);
        expect(manyToManyCollection.schema.fields.modelB_id).toHaveProperty('isPrimaryKey', true);
        // eslint-disable-next-line no-underscore-dangle
        expect(manyToManyCollection.schema.fields._id).toEqual(undefined);

        expect(manyToManyCollection.schema.fields).toEqual({
          modelA_id__aFieldRelation__manyToOne: {
            type: 'ManyToOne',
            foreignCollection: 'modelA',
            foreignKey: 'modelA_id',
            foreignKeyTarget: '_id',
          },
          modelA_id: expect.any(Object),
          modelB_id__aFieldRelation__manyToOne: {
            type: 'ManyToOne',
            foreignCollection: 'modelB',
            foreignKey: 'modelB_id',
            foreignKeyTarget: '_id',
          },
          modelB_id: expect.any(Object),
        });
      });
    });
  });
});
