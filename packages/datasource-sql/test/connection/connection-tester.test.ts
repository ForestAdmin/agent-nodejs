import type { Sequelize } from 'sequelize';

import testConnectionWithTimeOut from '../../src/connection/connection-tester';
import { DatabaseConnectError } from '../../src/connection/errors';

describe('testConnectionWithTimeOut', () => {
  it('should time out', async () => {
    jest.useFakeTimers();

    const sequelize = {
      authenticate: () =>
        new Promise(resolve => {
          setTimeout(resolve, 4000);
        }),
    };

    const promise = testConnectionWithTimeOut(sequelize as unknown as Sequelize, 'a db URI', 3000);

    jest.advanceTimersByTime(3000);

    await expect(promise).rejects.toThrow(DatabaseConnectError);
  });

  it('should pass before 3s', async () => {
    jest.useFakeTimers();

    const sequelize = {
      authenticate: () =>
        new Promise(resolve => {
          setTimeout(resolve, 2000);
        }),
    };

    const promise = testConnectionWithTimeOut(sequelize as unknown as Sequelize, 'a db URI', 3000);

    jest.advanceTimersByTime(2000);

    await expect(promise).resolves.not.toThrow();
  });
});
