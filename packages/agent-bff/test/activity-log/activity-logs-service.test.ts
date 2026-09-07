import { ActivityLogsService, ForestHttpApi } from '@forestadmin/forestadmin-client';

import createBffActivityLogsService from '../../src/activity-log/activity-logs-service';

jest.mock('@forestadmin/forestadmin-client', () => ({
  ...jest.requireActual('@forestadmin/forestadmin-client'),
  ActivityLogsService: jest.fn(),
}));

describe('BFF activity logs service', () => {
  it('should build the service with the BFF application source header', () => {
    createBffActivityLogsService('https://api.forestadmin.com');

    expect(ActivityLogsService).toHaveBeenCalledWith(expect.any(ForestHttpApi), {
      forestServerUrl: 'https://api.forestadmin.com',
      headers: { 'Forest-Application-Source': 'BFF' },
    });
  });
});
