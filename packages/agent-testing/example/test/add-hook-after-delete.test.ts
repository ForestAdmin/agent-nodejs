import { Agent } from '@forestadmin/agent';
import { buildSequelizeInstance, createSqlDataSource } from '@forestadmin/datasource-sql';
import { DataTypes } from 'sequelize';

import { createTestableAgent } from '../../src';
import TestableAgent from '../../src/integrations/testable-agent';
import { STORAGE_PREFIX, logger } from '../utils';

describe('addHook after delete', () => {
  let testableAgent: TestableAgent;
  let sequelize: Awaited<ReturnType<typeof buildSequelizeInstance>>;
  const storage = `${STORAGE_PREFIX}-hook.db`;

  const createHookCustomizer = (agent: Agent) => {
    agent.customizeCollection('assets', collection => {
      collection.addHook('After', 'Delete', async context => {
        // delete the replication assets
        await context.dataSource.getCollection('replicationAssets').delete(context.filter as any);
      });
    });
  };

  const createTable = async () => {
    sequelize = await buildSequelizeInstance({ dialect: 'sqlite', storage }, logger);

    sequelize.define('assets', { name: { type: DataTypes.STRING } }, { tableName: 'assets' });
    sequelize.define(
      'replicationAssets',
      { name: { type: DataTypes.STRING } },
      { tableName: 'replicationAssets' },
    );
    await sequelize.sync({ force: true });
  };

  beforeAll(async () => {
    await createTable();
    testableAgent = await createTestableAgent((agent: Agent) => {
      agent.addDataSource(createSqlDataSource({ dialect: 'sqlite', storage }));
      createHookCustomizer(agent);
    });
    await testableAgent.start();
  });

  afterAll(async () => {
    await testableAgent?.stop();
    await sequelize?.close();
  });

  it('should delete the replication assets when the main asset is removed', async () => {
    const asset = await sequelize.models.assets.create({ name: 'Gold' });
    await sequelize.models.replicationAssets.create({ name: 'Gold' });

    await testableAgent.collection('assets').delete([asset.dataValues.id]);

    // check that the replication asset has been deleted
    const replicationAssets = await sequelize.models.replicationAssets.findAll();
    expect(replicationAssets.length).toEqual(0);
  });
});
