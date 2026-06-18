import type { Logger } from '@forestadmin/datasource-toolkit';

import { createDemoFintechDataSource } from '../src/index';

describe('createDemoFintechDataSource', () => {
  it('should not crash', () => {
    expect(() => createDemoFintechDataSource()).not.toThrow();
  });

  it('should rebuild a fresh database on each boot without failing on existing tables', async () => {
    const logger: Logger = () => {};

    const restartAgent = jest.fn().mockResolvedValue(undefined);

    // The data source seeds a persistent SQLite file lazily, when the factory runs.
    // A second boot must drop the leftover database instead of failing on
    // `createTable` for tables that already exist.
    await createDemoFintechDataSource()(logger, restartAgent);

    await expect(createDemoFintechDataSource()(logger, restartAgent)).resolves.toBeDefined();
  });
});
