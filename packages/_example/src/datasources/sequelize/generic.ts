import { DataTypes, Dialect, Sequelize } from 'sequelize';
import faker from '@faker-js/faker';

import {
  DataSource,
  DataSourceDecorator,
  OperatorsEmulateCollectionDecorator,
  OperatorsReplaceCollectionDecorator,
  PublicationCollectionDecorator,
  RenameCollectionDecorator,
  SearchCollectionDecorator,
  SegmentCollectionDecorator,
  SortEmulateCollectionDecorator,
} from '@forestadmin/datasource-toolkit';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

async function prepareDatabase(dialect: Dialect, connectionString: string): Promise<Sequelize> {
  const sequelize = new Sequelize(connectionString);

  const City = sequelize.define(
    `${dialect}City`,
    {
      cityId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastUpdate: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.fn(dialect === 'mssql' ? 'getdate' : 'now'),
        allowNull: false,
      },
    },
    {
      tableName: 'city',
      underscored: true,
      timestamps: false,
    },
  );

  const Country = sequelize.define(
    `${dialect}Country`,
    {
      countryId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastUpdate: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.fn(dialect === 'mssql' ? 'getdate' : 'now'),
        allowNull: false,
      },
    },
    {
      tableName: 'country',
      underscored: true,
      timestamps: false,
    },
  );

  const Address = sequelize.define(
    `${dialect}Address`,
    {
      addressId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      address2: {
        type: DataTypes.STRING,
      },
      postalCode: {
        type: DataTypes.STRING,
      },
      lastUpdate: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.fn(dialect === 'mssql' ? 'getdate' : 'now'),
        allowNull: false,
      },
    },
    {
      tableName: 'address',
      underscored: true,
      timestamps: false,
    },
  );

  Country.hasMany(City, { foreignKey: 'countryId', sourceKey: 'countryId' });
  City.belongsTo(Country, { foreignKey: 'countryId', targetKey: 'countryId' });
  City.hasMany(Address, { foreignKey: 'cityId', sourceKey: 'cityId' });
  Address.belongsTo(City, { foreignKey: 'cityId', targetKey: 'cityId' });

  return sequelize;
}

export default async function prepareDataSource(connectionString: string): Promise<DataSource> {
  const [, dialect] = /(.*):\/\//.exec(connectionString);
  const sequelize = await prepareDatabase(dialect as Dialect, connectionString);

  // NOTICE: First call to ensure DB is ready to function.
  //         This is a hack to prevent open handle with Jest.
  if (process.env.NODE_ENV !== 'test') {
    await sequelize.sync({ force: true });
  }

  const dataSource = new SequelizeDataSource(sequelize);

  // NOTICE: First call to ensure DB is ready to function.
  //         This is a hack to prevent open handle with Jest.
  if (process.env.NODE_ENV !== 'test') {
    let cityRecords = [];
    let countryRecords = [];
    const addressRecords = [];
    const ENTRIES = 100;

    for (let i = 0; i < ENTRIES; i += 1) {
      countryRecords.push({
        country: faker.address.country(),
        lastUpdate: faker.datatype.datetime(),
      });
    }

    countryRecords = await dataSource.getCollection(`${dialect}Country`).create(countryRecords);

    for (let i = 0; i < ENTRIES; i += 1) {
      cityRecords.push({
        city: faker.address.city(),
        lastUpdate: faker.datatype.datetime(),
        countryId: countryRecords[Math.floor(Math.random() * countryRecords.length)].countryId,
      });
    }

    cityRecords = await dataSource.getCollection(`${dialect}City`).create(cityRecords);

    for (let i = 0; i < ENTRIES; i += 1) {
      addressRecords.push({
        address: faker.address.streetAddress(),
        address2: faker.address.secondaryAddress(),
        postalCode: faker.address.zipCode(),
        cityId: cityRecords[Math.floor(Math.random() * cityRecords.length)].cityId,
      });
    }

    await dataSource.getCollection(`${dialect}Address`).create(addressRecords);
  }

  let deco: DataSource = new DataSourceDecorator(dataSource, OperatorsEmulateCollectionDecorator);
  deco = new DataSourceDecorator(deco, OperatorsReplaceCollectionDecorator);
  deco = new DataSourceDecorator(deco, SortEmulateCollectionDecorator);
  deco = new DataSourceDecorator(deco, SegmentCollectionDecorator);
  deco = new DataSourceDecorator(deco, RenameCollectionDecorator);
  deco = new DataSourceDecorator(deco, PublicationCollectionDecorator);
  deco = new DataSourceDecorator(deco, SearchCollectionDecorator);

  return deco;
}
