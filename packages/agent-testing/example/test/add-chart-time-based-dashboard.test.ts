import { Agent } from '@forestadmin/agent';
import { buildSequelizeInstance, createSqlDataSource } from '@forestadmin/datasource-sql';
import { DataTypes } from 'sequelize';

import { createTestableAgent } from '../../src';
import TestableAgent from '../../src/integrations/testable-agent';
import { STORAGE_PREFIX, logger } from '../utils';

describe('addTimeBasedChart on dashboard', () => {
  let testableAgent: TestableAgent;
  let sequelize: Awaited<ReturnType<typeof buildSequelizeInstance>>;
  const storage = `${STORAGE_PREFIX}-chart-timeBased.db`;

  const dashboardChartCustomizer = (agent: Agent) => {
    agent.addChart('timeBasedCustomersChart', async (context, resultBuilder) => {
      const userCount = await context.dataSource.getCollection('customers').list({}, ['id']);

      return resultBuilder.timeBased('Day', [
        { date: new Date('2023-01-01'), value: userCount.length },
      ]);
    });
  };

  const createTable = async () => {
    sequelize = await buildSequelizeInstance({ dialect: 'sqlite', storage }, logger);

    sequelize.define(
      'customers',
      { firstName: { type: DataTypes.STRING } },
      { tableName: 'customers' },
    );
    await sequelize.sync({ force: true });
  };

  beforeAll(async () => {
    await createTable();
    testableAgent = await createTestableAgent((agent: Agent) => {
      agent.addDataSource(createSqlDataSource({ dialect: 'sqlite', storage }));
      dashboardChartCustomizer(agent);
    });
    await testableAgent.start();
  });

  afterAll(async () => {
    await testableAgent?.stop();
    await sequelize?.close();
  });

  it('should return the customers timeBased chart', async () => {
    await sequelize.models.customers.create({ firstName: 'John' });

    const count = await testableAgent.timeBasedChart('timeBasedCustomersChart');

    expect(count).toEqual([{ label: '01/01/2023', values: { value: 1 } }]);
  });
});
