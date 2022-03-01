import { DataTypes, Sequelize } from 'sequelize';

import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import { faker } from '@faker-js/faker';

const prepareDatabase = async (): Promise<Sequelize> => {
  const sequelize = new Sequelize('postgres://example:password@localhost:5442/example');

  const City = sequelize.define(
    'city',
    {
      id: {
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
        defaultValue: Sequelize.literal('now()'),
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
    'country',
    {
      id: {
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
        defaultValue: Sequelize.literal('now()'),
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
    'address',
    {
      id: {
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
        defaultValue: Sequelize.literal('now()'),
        allowNull: false,
      },
    },
    {
      tableName: 'address',
      underscored: true,
      timestamps: false,
    },
  );

  Country.hasMany(City);
  City.belongsTo(Country);
  City.hasMany(Address);
  Address.belongsTo(City);

  return sequelize;
};

const prepareDataSource = async (): Promise<SequelizeDataSource> => {
  const sequelize = await prepareDatabase();

  // NOTICE: First call to ensure DB is ready to function.
  //         This is a hack to prevent open handle with Jest.
  if (process.env.NODE_ENV !== 'test') {
    await sequelize.sync({ force: true });
  }

  const dataSource = new SequelizeDataSource(sequelize);

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

  countryRecords = await dataSource.getCollection('country').create(countryRecords);

  for (let i = 0; i < ENTRIES; i += 1) {
    cityRecords.push({
      city: faker.address.city(),
      lastUpdate: faker.datatype.datetime(),
      countryId: countryRecords[Math.floor(Math.random() * countryRecords.length)].id,
    });
  }

  cityRecords = await dataSource.getCollection('city').create(cityRecords);

  for (let i = 0; i < ENTRIES; i += 1) {
    addressRecords.push({
      address: faker.address.streetAddress(),
      address2: faker.address.secondaryAddress(),
      postalCode: faker.address.zipCode(),
      cityId: cityRecords[Math.floor(Math.random() * cityRecords.length)].id,
    });
  }

  await dataSource.getCollection('address').create(addressRecords);

  return dataSource;
};

export default prepareDataSource;
