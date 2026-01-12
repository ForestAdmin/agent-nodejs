import { Factory } from 'fishery';

import ActivityLogsService from '../../../src/activity-logs';
import forestAdminClientOptions from '../forest-admin-client-options';
import forestAdminServerInterface from '../forest-admin-server-interface';

const activityLogsServiceFactory = Factory.define<ActivityLogsService>(() => {
  return new ActivityLogsService(
    forestAdminServerInterface.build(),
    forestAdminClientOptions.build(),
  );
});

export default activityLogsServiceFactory;
