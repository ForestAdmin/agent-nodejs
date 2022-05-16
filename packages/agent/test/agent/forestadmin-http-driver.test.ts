import { DataSource } from '@forestadmin/datasource-toolkit';

import * as factories from './__factories__';
import { AgentOptionsWithDefaults } from '../../src/agent/types';
import ForestAdminHttpDriver from '../../src/agent/forestadmin-http-driver';
import ForestHttpApi from '../../src/agent/utils/forest-http-api';
import makeRoutes from '../../src/agent/routes';

jest.mock('../../src/agent/routes', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue([
    {
      setupRoutes: () => {},
      bootstrap: async () => {},
      tearDown: async () => {},
    },
  ]),
}));

jest.mock('../../src/agent/utils/forest-http-api', () => ({
  hasSchema: jest.fn(),
  uploadSchema: jest.fn(),
}));

describe('ForestAdminHttpDriver', () => {
  let dataSource: DataSource;
  let options: AgentOptionsWithDefaults;

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
    it('should start with one database', async () => {
      const httpDriver = new ForestAdminHttpDriver(dataSource, options);
      await httpDriver.start();

      expect(ForestHttpApi.hasSchema).toHaveBeenCalled();
      expect(makeRoutes).toHaveBeenCalled();
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

  describe('if we fail to contact forestadmin-server', () => {
    beforeEach(() => {
      (ForestHttpApi.hasSchema as jest.Mock).mockRejectedValue(new Error('an error'));
    });

    test('start() should rethrow the error and be done', async () => {
      const httpDriver = new ForestAdminHttpDriver(dataSource, options);

      await expect(() => httpDriver.start()).rejects.toThrow('an error');
    });
  });
});
