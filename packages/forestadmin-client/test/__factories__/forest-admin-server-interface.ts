import type { ForestAdminServerInterface } from '../../src/types';

const forestAdminServerInterface = {
  build: (): ForestAdminServerInterface => ({
    getRenderingPermissions: jest.fn(),
    getEnvironmentPermissions: jest.fn(),
    getUsers: jest.fn(),
    getModelCustomizations: jest.fn(),
    getMcpServerConfigs: jest.fn(),
    makeAuthService: jest.fn(),
    // MCP-specific methods
    getSchema: jest.fn(),
    createActivityLog: jest.fn(),
    updateActivityLogStatus: jest.fn(),
  }),
};

export default forestAdminServerInterface;
