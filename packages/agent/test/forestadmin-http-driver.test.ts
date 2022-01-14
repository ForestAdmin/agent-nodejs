import { DataSource } from '@forestadmin/datasource-toolkit';
import ForestAdminHttpDriver from '../src/forestadmin-http-driver';
import { ForestAdminHttpDriverOptions } from '../src/types';
import {
  dataSource as dataSourceBuilder,
  forestAdminHttpDriverOptions as optionsBuilder,
  forestAdminHttpDriverServices as servicesBuilder,
} from './__factories__';

// Mock routes
jest.mock('../src/routes', () => ({ RootRoutesCtor: [], CollectionRoutesCtor: [] }));

// Mock services
const hasSchema = jest.fn();
const uploadSchema = jest.fn();
jest.mock(
  '../src/services',
  () => () => servicesBuilder.build({ forestHTTPApi: { hasSchema, uploadSchema } }),
);

describe('ForestAdminHttpDriver', () => {
  let dataSource: DataSource;
  let options: ForestAdminHttpDriverOptions;

  beforeEach(() => {
    dataSource = dataSourceBuilder.build();
    options = optionsBuilder.build();

    hasSchema.mockReset();
    uploadSchema.mockReset();
  });

  test('should allow access to the request handler before being started', () => {
    // This is a requirement for forestadmin of forestadmin.
    // Otherwise forestadmin-server's in app integration can't be started.
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    expect(httpDriver.handler).toBeTruthy();
  });

  describe('if forestadmin-server already has the schema', () => {
    beforeEach(() => {
      hasSchema.mockResolvedValue(true);
    });

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

    test('start() should not upload the schema', async () => {
      const httpDriver = new ForestAdminHttpDriver(dataSource, options);
      await httpDriver.start();

      expect(hasSchema).toHaveBeenCalled();
      expect(uploadSchema).not.toHaveBeenCalled();
    });
  });

  describe('if forestadmin-server does not have the schema', () => {
    beforeEach(() => {
      hasSchema.mockResolvedValue(false);
    });

    test('start() should upload the schema', async () => {
      const httpDriver = new ForestAdminHttpDriver(dataSource, options);
      await httpDriver.start();

      expect(hasSchema).toHaveBeenCalled();
      expect(uploadSchema).toHaveBeenCalled();
    });
  });
});
