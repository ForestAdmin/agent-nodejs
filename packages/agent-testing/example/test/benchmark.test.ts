import { Agent } from '@forestadmin/agent';
import { buildSequelizeInstance, createSqlDataSource } from '@forestadmin/datasource-sql';
import { DataTypes } from 'sequelize';

import { createTestableAgent } from '../../src';
import TestableAgent from '../../src/integrations/testable-agent';
import { STORAGE_PREFIX, logger } from '../utils';

describe('benchmark', () => {
  let testableAgent: TestableAgent;
  let sequelize: Awaited<ReturnType<typeof buildSequelizeInstance>>;
  const storage = `${STORAGE_PREFIX}-segment.db`;

  // create a segment to get only minor users
  const segmentCustomizer = (agent: Agent) => {
    agent.customizeCollection('users', collection => {
      collection.addSegment('minorUsers', () => {
        return { field: 'age', operator: 'LessThan', value: 18 };
      });
    });
  };

  // create users table with age column
  const createTable = async () => {
    sequelize = await buildSequelizeInstance({ dialect: 'sqlite', storage }, logger);

    sequelize.define('users', { age: { type: DataTypes.INTEGER } }, { tableName: 'users' });
    await sequelize.sync({ force: true });
  };

  beforeAll(async () => {
    await createTable();
    testableAgent = await createTestableAgent((agent: Agent) => {
      agent.addDataSource(createSqlDataSource({ dialect: 'sqlite', storage }));
      segmentCustomizer(agent);
    });
    await testableAgent.start();
  });

  afterAll(async () => {
    await testableAgent?.stop();
    await sequelize?.close();
  });

  it('should return a benchmark', async () => {
    await sequelize.models.users.create({ age: 19 });
    await sequelize.models.users.create({ age: 17 });

    const result = await testableAgent
      .benchmark()
      .times(20)
      .run(async () => {
        await testableAgent.collection('users').segment('minorUsers').list();
      });

    expect(result.times).toEqual(20);
    expect(result.average).toEqual(expect.any(Number));
    expect(result.total).toEqual(expect.any(Number));
    expect(result.min).toEqual(expect.any(Number));
    expect(result.max).toEqual(expect.any(Number));
  });
});
