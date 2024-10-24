import { ForestHttpApi } from '..';
import { NotificationFromAgent } from '../permissions/forest-http-api';
import { ForestAdminClientOptionsWithDefaults } from '../types';

export default class NotifyFrontendService {
  private readonly options: ForestAdminClientOptionsWithDefaults;
  private readonly forestAdminServerInterface: ForestHttpApi;

  constructor(options, forestAdminServerInterface) {
    this.options = options;
    this.forestAdminServerInterface = forestAdminServerInterface;
  }

  notify(payload: NotificationFromAgent) {
    return this.forestAdminServerInterface.notifyFromAgent(this.options, payload);
  }
}
