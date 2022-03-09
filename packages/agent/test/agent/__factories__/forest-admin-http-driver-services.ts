import { Factory } from 'fishery';

import { ForestAdminHttpDriverServices } from '../../../src/agent/services';
import factoryPermissions from './permissions';
import factorySerializer from './serializer';

export default Factory.define<ForestAdminHttpDriverServices>(() => ({
  serializer: factorySerializer.build(),
  permissions: factoryPermissions.mockAllMethods().build(),
}));
