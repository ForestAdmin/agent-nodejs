import { Sequelize } from 'sequelize';

import testConnectionWithtimeOut from '../../src/connection/connection-tester';
import { DatabaseConnectError } from '../../src/connection/errors';

describe('testConnectionWithtimeOut', () => {
  it('should time out after 3s', async () => {
    const sequelize = {
      authenticate: () =>
        new Promise(resolve => {
          setTimeout(resolve, 4000);
        }),
    };

    await expect(
      testConnectionWithtimeOut(sequelize as unknown as Sequelize, 'a db URI', 3000),
    ).rejects.toThrow(DatabaseConnectError);
  });

  it('should pass before 3s', async () => {
    const sequelize = {
      authenticate: () =>
        new Promise(resolve => {
          setTimeout(resolve, 2000);
        }),
    };

    await expect(
      testConnectionWithtimeOut(sequelize as unknown as Sequelize, 'a db URI', 3000),
    ).resolves.not.toThrow();
  });
});
