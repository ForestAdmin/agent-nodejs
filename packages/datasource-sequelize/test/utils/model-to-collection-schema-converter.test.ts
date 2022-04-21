/* eslint-disable @typescript-eslint/no-explicit-any */
import { Association, DataTypes, ModelDefined, Sequelize } from 'sequelize';
import { CollectionSchema } from '@forestadmin/datasource-toolkit';
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
      expect(() => ModelToCollectionSchemaConverter.convert(null, () => {})).toThrow(
        'Invalid (null) model.',
      );
    });

    it('should return an "empty" schema with an equally empty model', () => {
      const { sequelize } = setup();

      // "ID" column is added by Sequelize when no primary key is explicitely defined.
      const schema: CollectionSchema = {
        actions: {},
        fields: {
          id: {
            columnType: 'Number',
            filterOperators: TypeConverter.operatorsForColumnType('Number'),
            isPrimaryKey: true,
            isReadOnly: true,
            validation: [],
            type: 'Column',
          },
        },
        searchable: false,
        segments: [],
      };

      const model = sequelize.define('__model__', {}, { timestamps: false });

      expect(ModelToCollectionSchemaConverter.convert(model, () => {})).toEqual(schema);
    });

    it('should honor primary key definition', () => {
      const { sequelize } = setup();

      const schema: CollectionSchema = {
        actions: {},
        fields: {
          myPk: {
            columnType: 'Number',
            filterOperators: TypeConverter.operatorsForColumnType('Number'),
            isPrimaryKey: true,
            isReadOnly: true,
            validation: [],
            type: 'Column',
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

      expect(ModelToCollectionSchemaConverter.convert(model, () => {})).toEqual(schema);
    });

    it('should convert all model attributes to collection fields', () => {
      const { sequelize } = setup();

      const schema: CollectionSchema = {
        actions: {},
        fields: {
          myPk: {
            columnType: 'Number',
            filterOperators: TypeConverter.operatorsForColumnType('Number'),
            isPrimaryKey: true,
            validation: [],
            type: 'Column',
          },
          myBoolean: {
            columnType: 'Boolean',
            filterOperators: TypeConverter.operatorsForColumnType('Boolean'),
            validation: [],
            type: 'Column',
          },
          myValue: {
            columnType: 'String',
            defaultValue: '__default__',
            filterOperators: TypeConverter.operatorsForColumnType('String'),
            validation: [],
            type: 'Column',
          },
          createdAt: {
            columnType: 'Date',
            filterOperators: TypeConverter.operatorsForColumnType('Date'),
            validation: [],
            type: 'Column',
          },
          updatedAt: {
            columnType: 'Date',
            filterOperators: TypeConverter.operatorsForColumnType('Date'),
            validation: [],
            type: 'Column',
          },
          myRequired: {
            columnType: 'Uuid',
            filterOperators: TypeConverter.operatorsForColumnType('Uuid'),
            validation: [
              {
                operator: 'Present',
              },
            ],
            type: 'Column',
          },
          myEnum: {
            columnType: 'Enum',
            filterOperators: TypeConverter.operatorsForColumnType('Enum'),
            enumValues: ['enum1', 'enum2', 'enum3'],
            validation: [],
            type: 'Column',
          },
          myJson: {
            columnType: 'Json',
            filterOperators: TypeConverter.operatorsForColumnType('Json'),
            defaultValue: { defautProperty: 'the value' },
            validation: [],
            type: 'Column',
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
          },
          myBoolean: {
            type: DataTypes.BOOLEAN,
          },
          myValue: {
            type: DataTypes.STRING,
            defaultValue: '__default__',
          },
          myRequired: {
            type: DataTypes.UUID,
            allowNull: false,
          },
          myEnum: {
            type: DataTypes.ENUM('enum1', 'enum2', 'enum3'),
          },
          myJson: {
            type: DataTypes.JSON,
            defaultValue: { defautProperty: 'the value' },
          },
        },
        { timestamps: true },
      );

      expect(ModelToCollectionSchemaConverter.convert(model, () => {})).toEqual(schema);
    });

    describe('with model containing associations', () => {
      describe('with belongsTo relation', () => {
        it('should build correct schema', () => {
          const { sequelize } = setup();

          const model = sequelize.define('__model__', {}, { timestamps: false });
          const model2 = sequelize.define('__model2__', {}, { timestamps: false });
          model.belongsTo(model2);

          const schema: CollectionSchema = {
            actions: {},
            fields: {
              Model2Id: {
                columnType: 'Number',
                filterOperators: TypeConverter.operatorsForColumnType('Number'),
                validation: [],
                type: 'Column',
              },
              __model2__: {
                foreignCollection: '__model2__',
                foreignKey: 'Model2Id',
                foreignKeyTarget: 'id',
                type: 'ManyToOne',
              },
              id: {
                columnType: 'Number',
                filterOperators: TypeConverter.operatorsForColumnType('Number'),
                isPrimaryKey: true,
                isReadOnly: true,
                validation: [],
                type: 'Column',
              },
            },
            searchable: false,
            segments: [],
          };

          expect(ModelToCollectionSchemaConverter.convert(model, () => {})).toEqual(schema);
        });
      });

      describe('with belongsToMany relation', () => {
        it('should build correct schema', () => {
          const { sequelize } = setup();

          const model = sequelize.define('__model__', {}, { timestamps: false });
          const model2 = sequelize.define('__model2__', {}, { timestamps: false });
          model.belongsToMany(model2, { through: 'ss' });
          model2.belongsToMany(model, { through: 'ss' });

          const schema: CollectionSchema = {
            actions: {},
            fields: {
              __model2__s: {
                foreignCollection: '__model2__',
                foreignKey: 'Model2Id',
                originKey: 'ModelId',
                throughCollection: 'ss',
                originKeyTarget: 'id',
                foreignKeyTarget: 'id',
                type: 'ManyToMany',
              },
              id: {
                columnType: 'Number',
                filterOperators: TypeConverter.operatorsForColumnType('Number'),
                isPrimaryKey: true,
                isReadOnly: true,
                validation: [],
                type: 'Column',
              },
            },
            searchable: false,
            segments: [],
          };

          expect(ModelToCollectionSchemaConverter.convert(model, () => {})).toEqual(schema);
        });
      });

      describe('with hasMany relation', () => {
        it('should build correct schema', () => {
          const { sequelize } = setup();

          const model = sequelize.define('__model__', {}, { timestamps: false });
          const model2 = sequelize.define('__model2__', {}, { timestamps: false });
          model.hasMany(model2);

          const schema: CollectionSchema = {
            actions: {},
            fields: {
              __model2__s: {
                foreignCollection: '__model2__',
                originKey: 'ModelId',
                originKeyTarget: 'id',
                type: 'OneToMany',
              },
              id: {
                columnType: 'Number',
                filterOperators: TypeConverter.operatorsForColumnType('Number'),
                isPrimaryKey: true,
                isReadOnly: true,
                validation: [],
                type: 'Column',
              },
            },
            searchable: false,
            segments: [],
          };

          expect(ModelToCollectionSchemaConverter.convert(model, () => {})).toEqual(schema);
        });
      });

      describe('with hasOne relation', () => {
        it('should build correct schema', () => {
          const { sequelize } = setup();

          const model = sequelize.define('__model__', {}, { timestamps: false });
          const model2 = sequelize.define('__model2__', {}, { timestamps: false });
          model.hasOne(model2);

          const schema: CollectionSchema = {
            actions: {},
            fields: {
              __model2__: {
                foreignCollection: '__model2__',
                originKey: 'ModelId',
                originKeyTarget: 'id',
                type: 'OneToOne',
              },
              id: {
                columnType: 'Number',
                filterOperators: TypeConverter.operatorsForColumnType('Number'),
                isPrimaryKey: true,
                isReadOnly: true,
                validation: [],
                type: 'Column',
              },
            },
            searchable: false,
            segments: [],
          };

          expect(ModelToCollectionSchemaConverter.convert(model, () => {})).toEqual(schema);
        });
      });

      describe('when association is unknown', () => {
        it('should Warn an error', () => {
          const model = {
            name: 'modelTest',
            getAttributes: () => ({}),
            associations: {
              relationsModel: {
                associationType: 'badAssociation',
              } as Association,
            } as ModelDefined<any, any>['associations'],
          } as ModelDefined<any, any>;

          const logger = jest.fn();
          ModelToCollectionSchemaConverter.convert(model, logger);

          expect(logger).toHaveBeenCalledWith(
            'Warn',
            "Skipping association 'modelTest.relationsModel' " +
              '(Unsupported association: "badAssociation".)',
          );
        });
      });
    });
  });
});
