import { DataSource } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';

import * as factories from './__factories__';
import { AgentOptionsWithDefaults } from '../../src/agent/types';
import ForestAdminHttpDriver from '../../src/agent/forestadmin-http-driver';

const mockSetupRoute = jest.fn();
const mockBootstrap = jest.fn();
const mockHasSchema = jest.fn();
const mockUploadSchema = jest.fn();
const mockMakeRoutes = jest.fn();

jest.mock('../../src/agent/routes', () => ({
  __esModule: true,
  default: (...args) => mockMakeRoutes(...args),
}));

jest.mock('../../src/agent/utils/forest-http-api', () => ({
  hasSchema: (...args) => mockHasSchema(...args),
  uploadSchema: (...args) => mockUploadSchema(...args),
}));

describe('ForestAdminHttpDriver', () => {
  let dataSource: DataSource;
  let options: AgentOptionsWithDefaults;

  beforeEach(() => {
    jest.resetAllMocks();
    mockBootstrap.mockResolvedValue(undefined);
    mockMakeRoutes.mockReturnValue([{ setupRoutes: mockSetupRoute, bootstrap: mockBootstrap }]);

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
  });

  describe('getRouter', () => {
    test('should initialize everything', async () => {
      const httpDriver = new ForestAdminHttpDriver(dataSource, options);
      const router = await httpDriver.getRouter();

      expect(router).toBeInstanceOf(Router);
      expect(mockBootstrap).toHaveBeenCalled();
      expect(mockMakeRoutes).toHaveBeenCalled();
      expect(mockSetupRoute).toHaveBeenCalled();
    });
  });

  describe('sendSchema', () => {
    test('should not send the schema if forestadmin already has it', async () => {
      mockHasSchema.mockResolvedValue(true);

      const httpDriver = new ForestAdminHttpDriver(dataSource, options);
      await httpDriver.sendSchema();

      expect(mockHasSchema).toHaveBeenCalled();
      expect(mockUploadSchema).not.toHaveBeenCalled();
    });

    test('should send the schema if forestadmin does not have it', async () => {
      mockHasSchema.mockResolvedValue(false);

      const httpDriver = new ForestAdminHttpDriver(dataSource, options);
      await httpDriver.sendSchema();

      expect(mockHasSchema).toHaveBeenCalled();
      expect(mockUploadSchema).toHaveBeenCalled();
    });
  });
});
