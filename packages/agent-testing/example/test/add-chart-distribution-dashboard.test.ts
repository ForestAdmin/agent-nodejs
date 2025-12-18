import { Agent } from '@forestadmin/agent';
import { buildSequelizeInstance, createSqlDataSource } from '@forestadmin/datasource-sql';
import { DataTypes } from 'sequelize';

import { createTestableAgent } from '../../src';
import TestableAgent from '../../src/integrations/testable-agent';
import { STORAGE_PREFIX, logger } from '../utils';

describe('addDistributionChart on dashboard', () => {
  let testableAgent: TestableAgent;
  let sequelize: Awaited<ReturnType<typeof buildSequelizeInstance>>;
  const storage = `${STORAGE_PREFIX}-chart-distribution.db`;

  const dashboardChartCustomizer = (agent: Agent) => {
    agent.addChart('distributionCustomersChart', async (context, resultBuilder) => {
      const userCount = await context.dataSource.getCollection('customers').list({}, ['id']);

      return resultBuilder.distribution({ users: userCount.length, totalUsers: 100 });
    });

    agent.customizeCollection('customers', collection => {
      collection.addChart(
        'distributionCustomersChartCollection',
        async (context, resultBuilder) => {
          return resultBuilder.distribution({
            users: parseInt(context.recordId.toString(), 10),
            totalUsers: 100,
          });
        },
      );
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

  it('should return the customers distribution chart', async () => {
    await sequelize.models.customers.create({ firstName: 'John' });

    const count = await testableAgent.distributionChart('distributionCustomersChart');

    expect(count).toEqual([
      { key: 'users', value: 1 },
      { key: 'totalUsers', value: 100 },
    ]);
  });

  describe('collection charts', () => {
    it('should return the customers distribution chart', async () => {
      await sequelize.models.customers.create({ firstName: 'John' });

      const count = await testableAgent
        .collection('customers')
        .distributionChart('distributionCustomersChartCollection', {
          recordId: '10',
        });

      expect(count).toEqual([
        { key: 'users', value: 10 },
        { key: 'totalUsers', value: 100 },
      ]);
    });
  });
});
