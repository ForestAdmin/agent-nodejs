import ForestAdminHttpDriver from '../src/forestadmin-http-driver';
import * as factories from './__factories__';

jest.mock('../src/routes', () => {
  return [];
});

describe('ForestAdminHttpDriver', () => {
  const dataSource = factories.dataSource.build();
  const options = factories.forestAdminHttpDriverOptions.build();

  test('should not allow to start multiple times', async () => {
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    await httpDriver.start();
    await expect(httpDriver.start()).rejects.toThrow('Agent cannot be restarted.');
  });

  test('should not allow to stop multiple times', async () => {
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    await httpDriver.start();
    await httpDriver.stop();
    await expect(httpDriver.stop()).rejects.toThrow('Agent is not running.');
  });

  test('should not allow to stop without starting', async () => {
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    await expect(httpDriver.stop()).rejects.toThrow('Agent is not running.');
  });

  test('should allow access to the request handler before being started', () => {
    // This is a requirement for forestadmin of forestadmin.
    // Otherwise forestadmin-server's in app integration can't be started.
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    expect(httpDriver.handler).toBeTruthy();
  });
});
