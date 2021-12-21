import Frontend from '../src/frontend';
import DataSourceMock from './__mocks__/datasource';

describe('Frontend', () => {
  const dataSource = new DataSourceMock();
  const options = {};

  test('should not allow to start multiple times', async () => {
    const frontend = new Frontend(dataSource, options);
    await frontend.start();
    await expect(frontend.start()).rejects.toEqual(new Error('Frontend cannot be restarted.'));
  });

  test('should not allow to stop multiple times', async () => {
    const frontend = new Frontend(dataSource, options);
    await frontend.start();
    await frontend.stop();
    await expect(frontend.stop()).rejects.toEqual(new Error('Frontend is not running.'));
  });

  test('should not allow to stop without starting', async () => {
    const frontend = new Frontend(dataSource, options);
    await expect(frontend.stop()).rejects.toEqual(new Error('Frontend is not running.'));
  });

  test('should allow access to the request handler before being started', () => {
    // This is a requirement for forestadmin of forestadmin.
    // Otherwise forestadmin-server's in app integration can't be started.
    const frontend = new Frontend(dataSource, options);
    expect(frontend.handler).toBeTruthy();
  });
});
