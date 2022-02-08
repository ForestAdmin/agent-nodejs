import { DataSource } from '@forestadmin/datasource-toolkit';

import ForestAdminHttpDriver from '../src/forestadmin-http-driver';
import RoutesFactory from '../src/routes/routes-factory';
import { ForestAdminHttpDriverOptions } from '../src/types';
import * as factories from './__factories__';

jest.mock('../src/routes', () => ({
  RootRoutesCtor: [],
  CollectionRoutesCtor: [],
  RelatedRoutesCtor: [],
}));

// Mock services
let makeRoutes: jest.SpyInstance;
const hasSchema = jest.fn();
const uploadSchema = jest.fn();
jest.mock(
  '../src/services',
  () => () =>
    factories.forestAdminHttpDriverServices.build({ forestHTTPApi: { hasSchema, uploadSchema } }),
);

describe('ForestAdminHttpDriver', () => {
  let dataSource: DataSource;
  let options: ForestAdminHttpDriverOptions;

  beforeEach(() => {
    makeRoutes = jest.spyOn(RoutesFactory, 'makeRoutes').mockReturnValue([]);

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

    hasSchema.mockReset();
    uploadSchema.mockReset();
  });

  test('should allow access to the request handler before being started', () => {
    // This is a requirement for forestadmin of forestadmin.
    // Otherwise forestadmin-server's in app integration can't be started.
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    expect(httpDriver.handler).toBeTruthy();
  });

  describe('start', () => {
    it('should start with one database', async () => {
      const httpDriver = new ForestAdminHttpDriver(dataSource, options);
      await httpDriver.start();

      expect(hasSchema).toHaveBeenCalled();
      expect(makeRoutes).toHaveBeenCalled();
    });

    it('should start with multiple databases', async () => {
      const httpDriver = new ForestAdminHttpDriver([dataSource, dataSource], options);
      await httpDriver.start();

      expect(hasSchema).toHaveBeenCalled();
      expect(makeRoutes).toHaveBeenCalled();
    });
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
