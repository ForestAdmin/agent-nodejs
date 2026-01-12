import { Factory } from 'fishery';

import SchemaService from '../../../src/schema';
import forestAdminClientOptions from '../forest-admin-client-options';
import forestAdminServerInterface from '../forest-admin-server-interface';

const schemaServiceFactory = Factory.define<SchemaService>(() => {
  return new SchemaService(forestAdminServerInterface.build(), forestAdminClientOptions.build());
});

export default schemaServiceFactory;
