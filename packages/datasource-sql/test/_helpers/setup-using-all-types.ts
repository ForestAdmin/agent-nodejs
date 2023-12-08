import { DataTypes, Dialect, Sequelize, literal } from 'sequelize';
import { Literal } from 'sequelize/types/utils';

import { ConnectionDetails } from './connection-details';

function getDefaultFunctionDateFromDialect(dialect: Dialect): Literal {
  switch (dialect) {
    case 'mariadb':
      return literal('current_timestamp()');
    case 'mssql':
      return literal('getdate()');
    case 'mysql':
    case 'sqlite':
      return literal('CURRENT_TIMESTAMP');
    case 'postgres':
      return literal('now()');
    default:
      throw new Error('Unexpected dialect');
  }
}

export function getAttributeMapping(dialect: Dialect) {
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

export default async (
  connectionDetails: ConnectionDetails,
  database: string,
  schema,
): Promise<Sequelize> => {
  let sequelize: Sequelize | null = null;

  try {
    if (connectionDetails.supports.multipleDatabases) {
      sequelize = new Sequelize(connectionDetails.url(), { logging: false });

      await sequelize.getQueryInterface().dropDatabase(database);
      await sequelize.getQueryInterface().createDatabase(database);
      await sequelize.close();
    }

    const optionalSchemaOption = schema ? { schema } : {};

    sequelize = new Sequelize(connectionDetails.url(database), {
      logging: false,
      ...optionalSchemaOption,
    });

    if (schema) {
      await sequelize.getQueryInterface().dropSchema(schema);
      await sequelize.getQueryInterface().createSchema(schema);
    }

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
          defaultValue: getDefaultFunctionDateFromDialect(connectionDetails.dialect),
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

    if (!['sqlite', 'mssql'].includes(connectionDetails.dialect)) {
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

    if (connectionDetails.dialect === 'mysql') {
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

    if (connectionDetails.dialect === 'postgres') {
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

    await sequelize.sync({ force: true });

    return sequelize;
  } catch (e) {
    console.error(e);
    throw e;
  } finally {
    await sequelize?.close();
  }
};
