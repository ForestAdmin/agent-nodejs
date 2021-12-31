import ForestAdminHttpDriver from '../src/forestadmin-http-driver';
import factories from './__factories__';

describe('ForestAdminHttpDriver', () => {
  const dataSource = factories.dataSource.build();
  const options = factories.forestAdminHttpDriverOptions.build({ prefix: '/forest' });

  test('should not allow to start multiple times', async () => {
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    await httpDriver.start();
    await expect(httpDriver.start()).rejects.toThrowError('Agent cannot be restarted.');
  });

  test('should not allow to stop multiple times', async () => {
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    await httpDriver.start();
    await httpDriver.stop();
    await expect(httpDriver.stop()).rejects.toThrowError('Agent is not running.');
  });

  test('should not allow to stop without starting', async () => {
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    await expect(httpDriver.stop()).rejects.toThrowError('Agent is not running.');
  });

  test('should allow access to the request handler before being started', () => {
    // This is a requirement for forestadmin of forestadmin.
    // Otherwise forestadmin-server's in app integration can't be started.
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    expect(httpDriver.handler).toBeTruthy();
  });
});
