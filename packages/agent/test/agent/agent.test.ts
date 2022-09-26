/* eslint-disable max-classes-per-file */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as factories from './__factories__';
import Agent from '../../src/agent/agent';

// Mock routes
const mockSetupRoute = jest.fn();
const mockBootstrap = jest.fn();
const mockMakeRoutes = jest
  .fn()
  .mockReturnValue([{ setupRoutes: mockSetupRoute, bootstrap: mockBootstrap }]);

jest.mock('../../src/agent/routes', () => ({
  __esModule: true,
  default: (...args) => mockMakeRoutes(...args),
}));

// Mock Forest admin Server
const mockHasSchema = jest.fn().mockReturnValue(false);
const mockUploadSchema = jest.fn();

jest.mock('../../src/agent/utils/forest-http-api', () => ({
  hasSchema: (...args) => mockHasSchema(...args),
  uploadSchema: (...args) => mockUploadSchema(...args),
}));

// Mock customizer
const mockUpdateTypesOnFileSystem = jest.fn();
const mockAddDataSource = jest.fn();
const mockAddChart = jest.fn();
const mockGetDataSource = jest.fn().mockResolvedValue(factories.dataSource.build());
const mockCustomizeCollection = jest.fn();

jest.mock('../../src/builder/utils/typing-generator', () => ({
  updateTypesOnFileSystem: (...a) => mockUpdateTypesOnFileSystem(...a),
}));

jest.mock(
  '../../src/builder/datasource',
  () =>
    class {
      addDataSource = mockAddDataSource;
      addChart = mockAddChart;
      getDataSource = mockGetDataSource;
      customizeCollection = mockCustomizeCollection;
    },
);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Agent', () => {
  const options = factories.forestAdminHttpDriverOptions.build();

  test('addDataSource should proxy the call', async () => {
    const collection = factories.collection.build({ name: 'books' });
    const dataSource = factories.dataSource.buildWithCollections([collection]);
    const factory = async () => dataSource;

    const agent = new Agent(options);
    agent.addDataSource(factory);

    expect(mockAddDataSource).toHaveBeenCalledTimes(1);
  });

  test('addChart should proxy the call', async () => {
    const agent = new Agent(options);
    agent.addChart('name', () => 666);

    expect(mockAddChart).toHaveBeenCalledTimes(1);
  });

  test('customizeCollection should proxy the call', async () => {
    const agent = new Agent(options);
    agent.customizeCollection('name', () => {});

    expect(mockCustomizeCollection).toHaveBeenCalledTimes(1);
  });

  test('start should upload apimap when unknown', async () => {
    const agent = new Agent(options);
    await agent.start();

    expect(mockHasSchema).toHaveBeenCalledTimes(1);
    expect(mockSetupRoute).toHaveBeenCalledTimes(1);
    expect(mockBootstrap).toHaveBeenCalledTimes(1);
    expect(mockMakeRoutes).toHaveBeenCalledTimes(1);
    expect(mockHasSchema).toHaveBeenCalledTimes(1);
    expect(mockUploadSchema).toHaveBeenCalledTimes(1);
    expect(mockGetDataSource).toHaveBeenCalledTimes(1);
    expect(mockUpdateTypesOnFileSystem).toHaveBeenCalledTimes(1);
  });

  test('start should not upload apimap when already known', async () => {
    mockHasSchema.mockReturnValue(true);

    const agent = new Agent(options);
    await agent.start();

    expect(mockUploadSchema).not.toHaveBeenCalled();
  });
});
