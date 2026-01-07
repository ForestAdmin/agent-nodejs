import { Agent } from '@forestadmin/agent';
import { buildSequelizeInstance, createSqlDataSource } from '@forestadmin/datasource-sql';
import { DataTypes } from 'sequelize';

import { createTestableAgent } from '../../src';
import TestableAgent from '../../src/integrations/testable-agent';
import { STORAGE_PREFIX, logger } from '../utils';

describe('addSegment', () => {
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
      agent.addDataSource(
        createSqlDataSource(
          { dialect: 'sqlite', storage },
          {
            liveQueryConnections: 'test-connection',
          },
        ),
      );
      segmentCustomizer(agent);
    });
    await testableAgent.start();
  });

  afterAll(async () => {
    await testableAgent?.stop();
    await sequelize?.close();
  });

  beforeEach(async () => {
    await sequelize.models.users.destroy({ where: {} });
  });

  it('should return only minor users', async () => {
    await sequelize.models.users.create({ age: 19 });
    await sequelize.models.users.create({ age: 17 });

    // get the created user
    const users = await testableAgent.collection('users').segment('minorUsers').list<{ age }>();

    // test the full name content
    expect(users.length).toEqual(1);
    expect(users[0].age).toEqual(17);
  });

  it('should return only minor users for live query segment', async () => {
    await sequelize.models.users.create({ age: 19 });
    await sequelize.models.users.create({ age: 17 });

    const users = await testableAgent
      .collection('users')
      .liveQuerySegment({
        connectionName: 'test-connection',
        query: 'SELECT * from users WHERE age < 18',
      })
      .list<{ age }>();

    // test the full name content
    expect(users.length).toEqual(1);
    expect(users[0].age).toEqual(17);
  });
});
