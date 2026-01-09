import type { ForestAdminServerInterface } from '../../src/types';

const forestAdminServerInterface = {
  build: (): ForestAdminServerInterface => ({
    getRenderingPermissions: jest.fn(),
    getEnvironmentPermissions: jest.fn(),
    getUsers: jest.fn(),
    getModelCustomizations: jest.fn(),
    getMcpServerConfigs: jest.fn(),
    makeAuthService: jest.fn(),
    // Schema operations
    getSchema: jest.fn(),
    postSchema: jest.fn(),
    checkSchemaHash: jest.fn(),
    // IP whitelist operations
    getIpWhitelistRules: jest.fn(),
    // Activity logs operations
    createActivityLog: jest.fn(),
    updateActivityLogStatus: jest.fn(),
  }),
};

export default forestAdminServerInterface;
