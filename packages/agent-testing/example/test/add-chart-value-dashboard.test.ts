import { Agent } from '@forestadmin/agent';
import { buildSequelizeInstance, createSqlDataSource } from '@forestadmin/datasource-sql';
import { DataTypes } from 'sequelize';

import { createTestableAgent } from '../../src';
import TestableAgent from '../../src/integrations/testable-agent';
import { STORAGE_PREFIX, logger } from '../utils';

describe('addValueChart on dashboard', () => {
  let testableAgent: TestableAgent;
  let sequelize: Awaited<ReturnType<typeof buildSequelizeInstance>>;
  const storage = `${STORAGE_PREFIX}-chart-value.db`;

  const dashboardChartCustomizer = (agent: Agent) => {
    agent.addChart('countCustomersChart', async (context, resultBuilder) => {
      const userCount = await context.dataSource.getCollection('customers').list({}, ['id']);

      // current value and previous value
      return resultBuilder.value(userCount.length, userCount.length - 1);
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

  it('should return the customers value chart', async () => {
    await sequelize.models.customers.create({ firstName: 'John' });
    await sequelize.models.customers.create({ firstName: 'Jean' });

    const chart = await testableAgent.valueChart('countCustomersChart');

    expect(chart.countCurrent).toEqual(2);
    expect(chart.countPrevious).toEqual(1);
  });
});
