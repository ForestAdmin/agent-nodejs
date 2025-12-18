import { Agent } from '@forestadmin/agent';
import { buildSequelizeInstance, createSqlDataSource } from '@forestadmin/datasource-sql';
import fs from 'fs';
import { DataTypes } from 'sequelize';

import { createTestableAgent } from '../../src';
import TestableAgent from '../../src/integrations/testable-agent';
import { STORAGE_PREFIX, logger } from '../utils';

describe('csv export', () => {
  let testableAgent: TestableAgent;
  let sequelize: Awaited<ReturnType<typeof buildSequelizeInstance>>;
  const storage = `${STORAGE_PREFIX}-csv.db`;

  const createTable = async () => {
    sequelize = await buildSequelizeInstance({ dialect: 'sqlite', storage }, logger);

    sequelize.define(
      'restaurants',
      {
        name: { type: DataTypes.STRING },
        rating: { type: DataTypes.INTEGER },
        comment: { type: DataTypes.STRING },
        metadata: { type: DataTypes.JSONB },
      },
      { tableName: 'restaurants' },
    );
    await sequelize.sync({ force: true });
  };

  beforeAll(async () => {
    await createTable();
    testableAgent = await createTestableAgent((agent: Agent) => {
      agent.addDataSource(createSqlDataSource({ dialect: 'sqlite', storage }));
    });
    await testableAgent.start();
  });

  afterAll(async () => {
    await testableAgent?.stop();
    await sequelize?.close();
  });

  beforeEach(async () => {
    await Promise.all([
      sequelize.models.restaurants.create({
        name: 'Best Forest Restaurant 1',
        rating: null,
        comment: null,
      }),
      sequelize.models.restaurants.create({
        name: 'Best Forest Restaurant 2',
        rating: null,
        comment: null,
      }),
      sequelize.models.restaurants.create({
        name: 'Best Forest Bar',
        rating: null,
        comment: null,
      }),
      sequelize.models.restaurants.create({
        name: 'Bad Forest Restaurant',
        rating: null,
        comment: null,
      }),
    ]);
  });

  it('should export the restaurants to CSV', async () => {
    const csvFilePath = '/tmp/restaurants.csv';
    const stream = fs.createWriteStream(csvFilePath);

    const list = await testableAgent.collection('restaurants').list({
      pagination: {
        number: 1,
        size: 1,
      },
    });

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      name: 'Best Forest Restaurant 1',
      comment: null,
    });

    await testableAgent.collection('restaurants').exportCsv(stream, {
      projection: ['name', 'comment'],
      filters: {
        conditionTree: {
          field: 'name',
          operator: 'Contains',
          value: 'Best Forest',
        },
      },
      sort: {
        field: 'name',
        ascending: false,
      },
      search: 'Restaurant',
    });

    expect(fs.readFileSync(csvFilePath, 'utf8')).toContain('Best Forest Restaurant');
    expect(fs.readFileSync(csvFilePath, 'utf8').split('\n')[0]).toContain(
      '"[""name""","""comment""]"',
    );
    expect(fs.readFileSync(csvFilePath, 'utf8').split('\n')[1]).toContain(
      'Best Forest Restaurant 2',
    );
    expect(fs.readFileSync(csvFilePath, 'utf8').split('\n')[2]).toContain(
      'Best Forest Restaurant 1',
    );
    expect(fs.readFileSync(csvFilePath, 'utf8').split('\n')[3]).toEqual('');
  });
});
