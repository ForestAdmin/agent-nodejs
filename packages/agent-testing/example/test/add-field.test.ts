import { Agent } from '@forestadmin/agent';
import { buildSequelizeInstance, createSqlDataSource } from '@forestadmin/datasource-sql';
import { DataTypes } from 'sequelize';

import { createTestableAgent } from '../../src';
import TestableAgent from '../../src/integrations/testable-agent';
import { STORAGE_PREFIX, logger } from '../utils';

describe('addField', () => {
  let testableAgent: TestableAgent;
  let sequelize: Awaited<ReturnType<typeof buildSequelizeInstance>>;
  const storage = `${STORAGE_PREFIX}-field.db`;

  const fullNameCustomizer = (agent: Agent) => {
    agent.customizeCollection('users', collection => {
      collection.addField('fullName', {
        columnType: 'String',
        dependencies: ['firstName', 'lastName'],
        getValues(records) {
          return records.map(record => `${record.firstName} ${record.lastName}`);
        },
      });
    });
  };

  const createTable = async () => {
    sequelize = await buildSequelizeInstance({ dialect: 'sqlite', storage }, logger);

    sequelize.define(
      'users',
      { firstName: { type: DataTypes.STRING }, lastName: { type: DataTypes.STRING } },
      { tableName: 'users' },
    );
    await sequelize.sync({ force: true });
  };

  beforeAll(async () => {
    await createTable();
    testableAgent = await createTestableAgent((agent: Agent) => {
      agent.addDataSource(createSqlDataSource({ dialect: 'sqlite', storage }));
      fullNameCustomizer(agent);
    });
    await testableAgent.start();
  });

  afterAll(async () => {
    await testableAgent?.stop();
    await sequelize?.close();
  });

  it('should return the computed full name from first name and last name', async () => {
    // create a user with firstName John and Doe as lastName
    const createdUser = await sequelize.models.users.create({ firstName: 'John', lastName: 'Doe' });

    // get the created user
    const [user] = await testableAgent.collection('users').list<{ fullName: string }>({
      filters: {
        conditionTree: { field: 'id', value: createdUser.dataValues.id, operator: 'Equal' },
      },
    });

    // test the full name content
    expect(user.fullName).toEqual('John Doe');
  });
});
