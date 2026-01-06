import { Factory } from 'fishery';

import ActivityLogsService from '../../../src/activity-logs';
import forestAdminClientOptions from '../forest-admin-client-options';

const activityLogsServiceFactory = Factory.define<ActivityLogsService>(() => {
  return new ActivityLogsService(forestAdminClientOptions.build());
});

export default activityLogsServiceFactory;
