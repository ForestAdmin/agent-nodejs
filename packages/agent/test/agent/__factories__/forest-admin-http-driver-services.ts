import { Factory } from 'fishery';

import { ForestAdminHttpDriverServices } from '../../../src/agent/services';
import factoryAuthorization from './authorization';
import factoryPermissions from './permissions/permissions';
import factorySerializer from './serializer';

export default Factory.define<ForestAdminHttpDriverServices>(() => ({
  serializer: factorySerializer.build(),
  permissions: factoryPermissions.mockAllMethods().build(),
  authorization: factoryAuthorization.mockAllMethods().build(),
}));
