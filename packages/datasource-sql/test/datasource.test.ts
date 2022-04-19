import { DataTypes, Dialect, Sequelize, literal } from 'sequelize';
import { Literal } from 'sequelize/types/utils';

import SqlDataSource from '../src/datasource';

function getDefaultFunctionDateFromDialect(dialect: Dialect): Literal {
  switch (dialect) {
    case 'mariadb':
      return literal('current_timestamp()');
    case 'mssql':
      return literal('getdate()');
    case 'mysql':
      return literal('CURRENT_TIMESTAMP');
    case 'postgres':
      return literal('now()');
    default:
      return null;
  }
}

function getAttributeMappingFromDialect(dialect: Dialect) {
  return {
    primitiveT: {
      id: {
        type: DataTypes.NUMBER(),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      string: {
        type: DataTypes.STRING(),
        allowNull: true,
        defaultValue: 'default string',
      },
      bool: {
        type: DataTypes.BOOLEAN(),
        allowNull: true,
        defaultValue: true,
      },
      int: {
        type: DataTypes.NUMBER(),
        allowNull: true,
        defaultValue: 2,
      },
      date: {
        type: DataTypes.DATE(),
        allowNull: true,
        defaultValue: getDefaultFunctionDateFromDialect(dialect),
      },
      date_as_default: {
        type: DataTypes.DATEONLY(),
        allowNull: true,
        defaultValue: '2022-03-14',
      },
    },
    timeStmpT: {
      id: {
        type: DataTypes.NUMBER(),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      createdAt: {
        type: DataTypes.DATE(),
        allowNull: false,
        _autoGenerated: true,
      },
      updatedAt: {
        type: DataTypes.DATE(),
        allowNull: false,
        _autoGenerated: true,
      },
    },
    paranoidT: {
      id: {
        type: DataTypes.NUMBER(),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      createdAt: {
        type: DataTypes.DATE(),
        allowNull: false,
        _autoGenerated: true,
      },
      updatedAt: {
        type: DataTypes.DATE(),
        allowNull: false,
        _autoGenerated: true,
      },
      deletedAt: {
        type: DataTypes.DATE(),
        _autoGenerated: true,
      },
    },
    enumT: {
      id: {
        type: DataTypes.NUMBER(),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      enum: {
        type: DataTypes.ENUM('enum1', 'enum2'),
        allowNull: true,
        defaultValue: 'enum1',
      },
    },
    jsonT: {
      id: {
        type: DataTypes.NUMBER(),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      json: {
        type: DataTypes.JSON(),
        allowNull: true,
        defaultValue: undefined,
      },
    },
    jsonBT: {
      id: {
        type: DataTypes.NUMBER(),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      json: {
        type: DataTypes.JSON(),
        allowNull: true,
        defaultValue: { aProperty: 'default value property' },
      },
    },
    arrayT: {
      id: {
        type: DataTypes.NUMBER(),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      arrayInt: {
        type: DataTypes.ARRAY(DataTypes.NUMBER),
        allowNull: true,
      },
      arrayString: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
      },
      arrayEnum: {
        type: DataTypes.ARRAY(DataTypes.ENUM('enum1', 'enum2')),
        allowNull: true,
      },
    },
  };
}

describe('datasource', () => {
  describe.each([
    ['postgres', 'test:password@localhost:5443'],
    ['mysql', 'root:password@localhost:3307'],
    ['mssql', 'sa:yourStrong(!)Password@localhost:1434'],
    ['mariadb', 'root:password@localhost:3809'],
  ])('on "%s" database', (dialect, connectionUrl) => {
    describe('with simple primitive fields', () => {
      const setupDatabase = async (database: string): Promise<Sequelize> => {
        let sequelize: Sequelize;

        try {
          let connectionUri = `${dialect}://${connectionUrl}`;
          sequelize = new Sequelize(connectionUri, { logging: false });

          await sequelize.getQueryInterface().dropDatabase(database);
          await sequelize.getQueryInterface().createDatabase(database);
          await sequelize.close();

          connectionUri = `${dialect}://${connectionUrl}/${database}`;
          sequelize = new Sequelize(connectionUri, { logging: false });

          sequelize.define(
            'primitiveT',
            {
              string: {
                type: DataTypes.STRING,
                defaultValue: 'default string',
              },
              bool: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
              },
              int: {
                type: DataTypes.INTEGER,
                defaultValue: 2,
              },
              date: {
                type: DataTypes.DATE,
                defaultValue: Sequelize.fn(dialect === 'mssql' ? 'getdate' : 'now'),
              },
              date_as_default: {
                type: DataTypes.DATEONLY,
                defaultValue: '2022-03-14',
              },
            },
            {
              timestamps: false,
              tableName: 'primitiveT',
            },
          );

          sequelize.define(
            'timeStmpT',
            {},
            {
              timestamps: true,
              tableName: 'timeStmpT',
            },
          );

          sequelize.define(
            'paranoidT',
            {},
            {
              timestamps: true,
              paranoid: true,
              tableName: 'paranoidT',
            },
          );

          if (dialect !== 'mssql') {
            sequelize.define(
              'enumT',
              {
                enum: {
                  type: DataTypes.ENUM('enum1', 'enum2'),
                  defaultValue: 'enum1',
                },
              },
              { tableName: 'enumT', timestamps: false },
            );
          }

          if (dialect === 'mysql') {
            sequelize.define(
              'jsonT',
              {
                json: {
                  type: DataTypes.JSON,
                },
              },
              {
                timestamps: false,
                tableName: 'jsonT',
              },
            );
          }

          if (dialect === 'postgres') {
            sequelize.define(
              'jsonBT',
              {
                json: {
                  type: DataTypes.JSONB,
                  defaultValue: { aProperty: 'default value property' },
                },
              },
              {
                timestamps: false,
                tableName: 'jsonBT',
              },
            );

            sequelize.define(
              'arrayT',
              {
                arrayInt: {
                  type: DataTypes.ARRAY(DataTypes.INTEGER),
                  defaultValue: [1, 2],
                },
                arrayString: {
                  type: DataTypes.ARRAY(DataTypes.STRING),
                  defaultValue: ['tata', 'toto'],
                },
                arrayEnum: {
                  type: DataTypes.ARRAY(DataTypes.ENUM('enum1', 'enum2')),
                  defaultValue: ['enum1'],
                },
              },
              {
                timestamps: false,
                tableName: 'arrayT',
              },
            );
          }

          await sequelize.getQueryInterface().dropAllTables();
          await sequelize.sync({ force: true });

          return sequelize;
        } catch (error) {
          throw new Error(`Test initialization fail: ${error.message}`);
        } finally {
          await sequelize?.close();
        }
      };

      it('should generate a sql datasource with default values', async () => {
        const databaseName = 'datasource-sql-primitive-field-test';
        const setupSequelize = await setupDatabase(databaseName);
        const setupModels = setupSequelize.models;
        const attributesMapping = getAttributeMappingFromDialect(dialect as Dialect);

        let dataSourceSequelize: Sequelize;

        try {
          const connectionUri = `${dialect}://${connectionUrl}/${databaseName}`;
          const sqlDatasource = new SqlDataSource(connectionUri);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dataSourceSequelize = (sqlDatasource as any).sequelize as Sequelize;

          await sqlDatasource.build();

          const dataSourceModels = dataSourceSequelize.models;

          Object.values(setupModels).forEach(setupModel => {
            const model = dataSourceModels[setupModel.name];

            expect(model).toBeDefined();

            Object.entries(model.getAttributes()).forEach(([fieldName, attributeDefinition]) => {
              expect({ [fieldName]: attributeDefinition }).toStrictEqual({
                [fieldName]: expect.objectContaining(attributesMapping[model.name][fieldName]),
              });
            });
          });
        } finally {
          // avoid open handles
          await dataSourceSequelize?.close();
        }
      });
    });

    describe('whith relations', () => {
      const setupDatabase = async (database: string): Promise<Sequelize> => {
        let sequelize: Sequelize;

        try {
          let connectionUri: string;

          connectionUri = `${dialect}://${connectionUrl}`;
          sequelize = new Sequelize(connectionUri, { logging: false });
          await sequelize.getQueryInterface().dropDatabase(database);
          await sequelize.getQueryInterface().createDatabase(database);
          await sequelize.close();

          connectionUri = `${dialect}://${connectionUrl}/${database}`;
          sequelize = new Sequelize(connectionUri, { logging: false });

          const aT = sequelize.define('aT', {}, { tableName: 'aT', timestamps: false });
          const bT = sequelize.define('bT', {}, { tableName: 'bT', timestamps: false });
          const cT = sequelize.define('cT', {}, { tableName: 'cT', timestamps: false });
          const dT = sequelize.define('dT', {}, { tableName: 'dT', timestamps: false });
          const eT = sequelize.define('eT', {}, { tableName: 'eT', timestamps: false });
          const fT = sequelize.define('fT', {}, { tableName: 'fT', timestamps: false });

          aT.belongsTo(bT);
          bT.hasMany(aT);
          cT.belongsToMany(dT, { through: 'cdT' });
          dT.belongsToMany(cT, { through: 'cdT' });
          eT.hasOne(fT);
          fT.belongsTo(eT);

          await sequelize.getQueryInterface().dropAllTables();
          await sequelize.sync({ force: true });
          await sequelize
            .getQueryInterface()
            .addConstraint(fT.name, { type: 'unique', fields: ['eTId'] });

          return sequelize;
        } catch (error) {
          throw new Error(`Test initialization fail: ${error.message}`);
        } finally {
          await sequelize?.close();
        }
      };

      it('should generate a sql datasource with relation', async () => {
        const databaseName = 'datasource-sql-relation-test';
        const setupSequelize = await setupDatabase(databaseName);
        const setupModels = setupSequelize.models;

        let dataSourceSequelize: Sequelize;

        try {
          const connectionUri = `${dialect}://${connectionUrl}/${databaseName}`;
          const sqlDatasource = new SqlDataSource(connectionUri);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dataSourceSequelize = (sqlDatasource as any).sequelize as Sequelize;

          await sqlDatasource.build();

          const dataSourceModels = dataSourceSequelize.models;

          Object.values(setupModels).forEach(setupModel => {
            const model = dataSourceModels[setupModel.name];

            expect(model).toBeDefined();
            // TODO: test associations on each models
          });

          const belongsToModel = dataSourceModels.cdT;
          expect(belongsToModel).toBeDefined();
          // TODO: test associations on this model
        } finally {
          // avoid open handles
          await dataSourceSequelize?.close();
        }
      });
    });
  });
});
