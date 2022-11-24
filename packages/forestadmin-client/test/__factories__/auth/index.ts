import { Factory } from 'fishery';

import AuthService from '../../../src/auth';
import forestAdminClientOptions from '../forest-admin-client-options';

const authServiceFactory = Factory.define<AuthService>(() => {
  return new AuthService(forestAdminClientOptions.build());
});

export default authServiceFactory;
