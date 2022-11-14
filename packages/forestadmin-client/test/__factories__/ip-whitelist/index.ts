import { Factory } from 'fishery';

import IpWhitelistService from '../../../src/ip-whitelist';
import forestAdminClientOptions from '../forest-admin-client-options';

const ipWhitelistServiceFactory = Factory.define<IpWhitelistService>(() => {
  return new IpWhitelistService(forestAdminClientOptions.build());
});

export default ipWhitelistServiceFactory;
