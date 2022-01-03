import ForestAdminHttpDriver from '../src/forestadmin-http-driver';
import DataSourceMock from './__mocks__/datasource';

describe('ForestAdminHttpDriver', () => {
  const dataSource = new DataSourceMock();
  const options = { prefix: '/forest' };

  test('should not allow to start multiple times', async () => {
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    await httpDriver.start();
    await expect(httpDriver.start()).rejects.toEqual(new Error('Agent cannot be restarted.'));
  });

  test('should not allow to stop multiple times', async () => {
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    await httpDriver.start();
    await httpDriver.stop();
    await expect(httpDriver.stop()).rejects.toEqual(new Error('Agent is not running.'));
  });

  test('should not allow to stop without starting', async () => {
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    await expect(httpDriver.stop()).rejects.toEqual(new Error('Agent is not running.'));
  });

  test('should allow access to the request handler before being started', () => {
    // This is a requirement for forestadmin of forestadmin.
    // Otherwise forestadmin-server's in app integration can't be started.
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    expect(httpDriver.handler).toBeTruthy();
  });
});
