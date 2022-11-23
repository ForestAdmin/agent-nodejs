import { Factory } from 'fishery';

import SchemaService from '../../../src/schema';
import forestAdminClientOptions from '../forest-admin-client-options';

const schemaServiceFactory = Factory.define<SchemaService>(() => {
  return new SchemaService(forestAdminClientOptions.build());
});

export default schemaServiceFactory;
