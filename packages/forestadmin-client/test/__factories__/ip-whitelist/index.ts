import { Factory } from 'fishery';

import IpWhitelistService from '../../../src/ip-whitelist';
import forestAdminClientOptions from '../forest-admin-client-options';
import forestAdminServerInterface from '../forest-admin-server-interface';

const ipWhitelistServiceFactory = Factory.define<IpWhitelistService>(() => {
  return new IpWhitelistService(
    forestAdminServerInterface.build(),
    forestAdminClientOptions.build(),
  );
});

export default ipWhitelistServiceFactory;
