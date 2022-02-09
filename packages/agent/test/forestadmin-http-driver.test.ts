import { DataSource } from '@forestadmin/datasource-toolkit';
import ForestAdminHttpDriver from '../src/forestadmin-http-driver';
import { CollectionRoutesCtor, RootRoutesCtor } from '../src/routes';
import CountRoute from '../src/routes/access/count';
import HealthCheck from '../src/routes/healthcheck';
import { ForestAdminHttpDriverOptionsWithDefaults } from '../src/types';
import ForestHttpApi from '../src/utils/forest-http-api';
import * as factories from './__factories__';

// Mock dependencies
jest.mock('../src/routes', () => ({ RootRoutesCtor: [], CollectionRoutesCtor: [] }));
CollectionRoutesCtor.push(CountRoute);
RootRoutesCtor.push(HealthCheck);

jest.mock('../src/utils/forest-http-api', () => ({
  hasSchema: jest.fn(),
  uploadSchema: jest.fn(),
}));

describe('ForestAdminHttpDriver', () => {
  let dataSource: DataSource;
  let options: ForestAdminHttpDriverOptionsWithDefaults;

  beforeEach(() => {
    dataSource = factories.dataSource.buildWithCollection({
      name: 'person',
      schema: factories.collectionSchema.build({
        fields: {
          birthdate: factories.columnSchema.isPrimaryKey().build(),
          firstName: factories.columnSchema.build(),
          lastName: factories.columnSchema.isPrimaryKey().build(),
        },
      }),
    });
    options = factories.forestAdminHttpDriverOptions.build();

    (ForestHttpApi.hasSchema as jest.Mock).mockReset();
    (ForestHttpApi.uploadSchema as jest.Mock).mockReset();
  });

  test('should allow access to the request handler before being started', () => {
    // This is a requirement for forestadmin of forestadmin.
    // Otherwise forestadmin-server's in app integration can't be started.
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    expect(httpDriver.handler).toBeTruthy();
  });

  describe('start', () => {
    it('shoud start with one database', async () => {
      const httpDriver = new ForestAdminHttpDriver(dataSource, options);
      await httpDriver.start();

      expect(ForestHttpApi.hasSchema).toHaveBeenCalled();
    });

    it('shoud start with multiple databases', async () => {
      const httpDriver = new ForestAdminHttpDriver([dataSource, dataSource], options);
      await httpDriver.start();

      expect(ForestHttpApi.hasSchema).toHaveBeenCalled();
    });
  });

  describe('if forestadmin-server already has the schema', () => {
    beforeEach(() => {
      (ForestHttpApi.hasSchema as jest.Mock).mockResolvedValue(true);
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

      expect(ForestHttpApi.hasSchema).toHaveBeenCalled();
      expect(ForestHttpApi.uploadSchema).not.toHaveBeenCalled();
    });
  });

  describe('if forestadmin-server does not have the schema', () => {
    beforeEach(() => {
      (ForestHttpApi.hasSchema as jest.Mock).mockResolvedValue(false);
    });

    test('start() should upload the schema', async () => {
      const httpDriver = new ForestAdminHttpDriver(dataSource, options);
      await httpDriver.start();

      expect(ForestHttpApi.hasSchema).toHaveBeenCalled();
      expect(ForestHttpApi.uploadSchema).toHaveBeenCalled();
    });
  });
});
