import type { Logger } from '@forestadmin/datasource-toolkit';

import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { createSqlDataSource } from '../../src';
import ConnectionOptions from '../../src/connection/connection-options';
import SequelizeFactory from '../../src/connection/sequelize-factory';

const logger = jest.fn() as unknown as Logger;

describe('schema.databases', () => {
  it('reports the sqlite file name for a file storage', async () => {
    const storage = join(mkdtempSync(join(tmpdir(), 'forestadmin-t6c496103e-')), 'cache.db');
    const dataSource = await createSqlDataSource({ dialect: 'sqlite', storage })(logger, jest.fn());

    expect(dataSource.schema.databases).toStrictEqual([{ type: 'sqlite', name: 'cache.db' }]);

    await (dataSource as SequelizeDataSource).close();
  });

  it('normalises the postgresql uri alias to postgres', async () => {
    const options = new ConnectionOptions(
      'postgresql://SENTINEL_USER:SENTINEL_SECRET@SENTINEL_HOST:5432/mydb',
    );
    const sequelize = SequelizeFactory.build(await options.buildSequelizeCtorOptions());
    const dataSource = new SequelizeDataSource(sequelize);

    expect(dataSource.schema.databases).toStrictEqual([{ type: 'postgres', name: 'mydb' }]);
    expect(JSON.stringify(dataSource.schema.databases)).not.toContain('SENTINEL_');

    await sequelize.close();
  });
});
