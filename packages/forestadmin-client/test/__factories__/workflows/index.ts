import { Factory } from 'fishery';

import WorkflowsService from '../../../src/workflows';
import forestAdminClientOptions from '../forest-admin-client-options';
import forestAdminServerInterface from '../forest-admin-server-interface';

const workflowsServiceFactory = Factory.define<WorkflowsService>(() => {
  return new WorkflowsService(forestAdminServerInterface.build(), forestAdminClientOptions.build());
});

export default workflowsServiceFactory;
