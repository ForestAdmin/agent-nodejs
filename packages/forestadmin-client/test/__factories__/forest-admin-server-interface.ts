import { Factory } from 'fishery';

import { ForestAdminServerInterface } from '../../src/types';

export default Factory.define<ForestAdminServerInterface>(() => ({
  getRenderingPermissions: jest.fn(),
  getEnvironmentPermissions: jest.fn(),
  getUsers: jest.fn(),
  getModelCustomizations: jest.fn(),
}));
