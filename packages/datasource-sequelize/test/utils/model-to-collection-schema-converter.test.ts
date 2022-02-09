import { DataTypes, Sequelize } from 'sequelize';
import {
  CollectionSchema,
  FieldTypes,
  Operator,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';

// eslint-disable-next-line max-len
import ModelToCollectionSchemaConverter from '../../src/utils/model-to-collection-schema-converter';
import TypeConverter from '../../src/utils/type-converter';

describe('Utils > ModelToCollectionSchemaConverter', () => {
  describe('convert', () => {
    const setup = () => {
      const sequelize = new Sequelize('sqlite::memory:', { logging: false });

      return {
        sequelize,
      };
    };

    it('should fail with a null model', () => {
      expect(() => ModelToCollectionSchemaConverter.convert(null)).toThrow('Invalid (null) model.');
    });

    it('should return an "empty" schema with an equally empty model', () => {
      const { sequelize } = setup();

      // "ID" column is added by Sequelize when no primary key is explicitely defined.
      const schema: CollectionSchema = {
        actions: {},
        fields: {
          id: {
            columnType: PrimitiveTypes.Number,
            filterOperators: TypeConverter.operatorsForDataType(DataTypes.INTEGER),
            isPrimaryKey: true,
            type: FieldTypes.Column,
          },
        },
        searchable: false,
        segments: [],
      };

      const model = sequelize.define('__model__', {}, { timestamps: false });

      expect(ModelToCollectionSchemaConverter.convert(model)).toEqual(schema);
    });

    it('should honor primary key definition', () => {
      const { sequelize } = setup();

      const schema: CollectionSchema = {
        actions: {},
        fields: {
          myPk: {
            columnType: PrimitiveTypes.Number,
            filterOperators: TypeConverter.operatorsForDataType(DataTypes.INTEGER),
            isPrimaryKey: true,
            type: FieldTypes.Column,
          },
        },
        searchable: false,
        segments: [],
      };

      const model = sequelize.define(
        '__model__',
        {
          myPk: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
        },
        { timestamps: false },
      );

      expect(ModelToCollectionSchemaConverter.convert(model)).toEqual(schema);
    });

    it('should convert all model attributes to collection fields', () => {
      const { sequelize } = setup();

      const schema: CollectionSchema = {
        actions: {},
        fields: {
          myPk: {
            columnType: PrimitiveTypes.Number,
            filterOperators: TypeConverter.operatorsForDataType(DataTypes.INTEGER),
            isPrimaryKey: true,
            type: FieldTypes.Column,
          },
          myBoolean: {
            columnType: PrimitiveTypes.Boolean,
            filterOperators: TypeConverter.operatorsForDataType(DataTypes.BOOLEAN),
            type: FieldTypes.Column,
          },
          myValue: {
            columnType: PrimitiveTypes.String,
            defaultValue: '__default__',
            filterOperators: TypeConverter.operatorsForDataType(DataTypes.STRING),
            type: FieldTypes.Column,
          },
          createdAt: {
            columnType: PrimitiveTypes.Date,
            filterOperators: TypeConverter.operatorsForDataType(DataTypes.DATE),
            type: FieldTypes.Column,
          },
          updatedAt: {
            columnType: PrimitiveTypes.Date,
            filterOperators: TypeConverter.operatorsForDataType(DataTypes.DATE),
            type: FieldTypes.Column,
          },
        },
        searchable: false,
        segments: [],
      };

      const model = sequelize.define(
        '__model__',
        {
          myPk: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          myBoolean: {
            type: DataTypes.BOOLEAN,
          },
          myValue: {
            type: DataTypes.STRING,
            defaultValue: '__default__',
          },
        },
        { timestamps: true },
      );

      expect(ModelToCollectionSchemaConverter.convert(model)).toEqual(schema);
    });
  });
});
