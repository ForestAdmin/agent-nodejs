import { DataTypes, Dialect, Sequelize } from 'sequelize';

(async () => {
  let sequelize: Sequelize;

  try {
    const dialect: Dialect = process.env.SQL_DIALECT as Dialect;

    switch (dialect) {
      case 'mssql':
        sequelize = new Sequelize('mssql://sa:yourStrong(!)Password@localhost:1433/example');
        break;
      case 'mysql':
        sequelize = new Sequelize('mysql://example:password@localhost:3306/example');
        break;
      default:
        sequelize = new Sequelize('postgres://example:password@localhost:5442/example');
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
        enum: {
          type: DataTypes.ENUM('enum1', 'enum2'),
          defaultValue: 'enum1',
        },
        date: {
          type: DataTypes.DATE,
          defaultValue: Sequelize.fn(dialect === 'mssql' ? 'getdate' : 'now'),
        },
        dateAsDefault: {
          type: DataTypes.DATE,
          defaultValue: '2022-03-14 09:44:52',
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
        'jsonT',
        {
          json: {
            type: DataTypes.JSONB,
            defaultValue: { toto: 'a que coucou' },
          },
        },
        {
          timestamps: false,
          tableName: 'jsonT',
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
  } catch (error) {
    console.error(error);
  } finally {
    if (sequelize) sequelize.close();
  }
})();
