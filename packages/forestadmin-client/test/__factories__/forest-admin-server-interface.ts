import { ForestAdminServerInterface } from '../../src/types';

const forestAdminServerInterface = {
  build: (): ForestAdminServerInterface => ({
    getRenderingPermissions: jest.fn(),
    getEnvironmentPermissions: jest.fn(),
    getUsers: jest.fn(),
    getModelCustomizations: jest.fn(),
    getMcpServerConfigs: jest.fn(),
    makeAuthService: jest.fn(),
  }),
};

export default forestAdminServerInterface;
