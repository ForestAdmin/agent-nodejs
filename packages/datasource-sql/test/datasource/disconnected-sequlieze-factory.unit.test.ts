import type { SupportedIntrospection } from '../../src';

import { Sequelize } from 'sequelize';

import { buildDisconnectedSequelizeInstance } from '../../src';

describe('buildDisconnectedSequelizeInstance', () => {
  const introspection: SupportedIntrospection = {
    source: '@forestadmin/datasource-sql',
    version: 3,
    tables: [{ name: 'books', columns: [], schema: 'public', unique: [] }],
    views: [],
  };

  it('should return a Sequelize instance without a running database', async () => {
    const sequelize = await buildDisconnectedSequelizeInstance(introspection, jest.fn());
    expect(sequelize).toBeInstanceOf(Sequelize);
    expect(sequelize.models.books).toBeDefined();
  });
});
