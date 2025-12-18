import { Agent } from '@forestadmin/agent';
import { buildSequelizeInstance, createSqlDataSource } from '@forestadmin/datasource-sql';
import { DataTypes } from 'sequelize';

import { createTestableAgent } from '../../src';
import TestableAgent from '../../src/integrations/testable-agent';
import { STORAGE_PREFIX, logger } from '../utils';

describe('replaceFieldWriting', () => {
  let testableAgent: TestableAgent;
  let sequelize: Awaited<ReturnType<typeof buildSequelizeInstance>>;
  const storage = `${STORAGE_PREFIX}-replace-field-writing.db`;

  const fullNameCustomizer = (agent: Agent) => {
    agent.customizeCollection('users', collection => {
      collection
        .addField('fullName', {
          columnType: 'String',
          dependencies: ['firstName', 'lastName'],
          getValues(records) {
            return records.map(record => `${record.firstName} ${record.lastName}`);
          },
        })
        .replaceFieldWriting('fullName', fullName => {
          const [firstName, lastName] = fullName.split(' ');

          return { firstName, lastName };
        });
    });
  };

  beforeEach(async () => {
    // reset the database
    await sequelize.sync({ force: true });
  });

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

  it('should create a user with the first name and last name', async () => {
    await testableAgent.collection('users').create({ fullName: 'John Doe' });
    const [user] = await testableAgent.collection('users').list<{ firstName; lastName }>();

    expect(user.firstName).toEqual('John');
    expect(user.lastName).toEqual('Doe');
  });

  it('should update a user with the first name and last name', async () => {
    const createdUser = await testableAgent
      .collection('users')
      .create<{ id: string }>({ fullName: 'John Doe' });

    await testableAgent.collection('users').update(createdUser.id, { fullName: 'Al Berto' });

    const [user] = await testableAgent.collection('users').list<{ firstName; lastName }>();
    expect(user.firstName).toEqual('Al');
    expect(user.lastName).toEqual('Berto');
  });

  it('should count the created users', async () => {
    // create a user
    await testableAgent.collection('users').create({ fullName: 'John Doe' });
    await testableAgent.collection('users').create({ fullName: 'John Doe' });
    await testableAgent.collection('users').create({ fullName: 'John Doe' });

    const count = await testableAgent.collection('users').count();

    // test the full name content
    expect(count).toEqual(3);
  });
});
