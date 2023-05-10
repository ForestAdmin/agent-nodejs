import EventSource from 'eventsource';

import { ServerEvent, ServerEventType } from './types';
import ActionPermissionService from '../permissions/action-permission';
import RenderingPermissionService from '../permissions/rendering-permission';
import UserPermissionService from '../permissions/user-permission';
import { ForestAdminClientOptionsWithDefaults } from '../types';

export default class EventsSubscriptionService {
  constructor(
    private options: ForestAdminClientOptionsWithDefaults,
    private readonly permissionService: ActionPermissionService,
    private readonly usersPermissionService: UserPermissionService,
    private readonly renderingPermissionService: RenderingPermissionService,
  ) {}

  async subscribeEvents(callbackCustomizations?: () => Promise<void>): Promise<void> {
    const url = new URL('/liana/v4/events', this.options.forestServerUrl).toString();
    const eventSourceConfig = {
      // forest-secret-key act as the credential
      withCredentials: false,
      headers: { 'forest-secret-key': this.options.envSecret },
      https: { rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? true },
    };

    const source = new EventSource(url, eventSourceConfig);

    source.addEventListener('message', async (event: ServerEvent) => {
      const { type, data } = event.data;

      this.options.logger('Debug', `Event - ${type}`);

      switch (type) {
        case ServerEventType.RefreshUsers:
          this.usersPermissionService.invalidateCache();
          break;

        case ServerEventType.RefreshRoles:
          this.permissionService.invalidateCache();
          break;

        case ServerEventType.RefreshRenderings:
          for (const renderingId of data as [string])
            this.renderingPermissionService.invalidateCache(renderingId);
          break;

        case ServerEventType.RefreshCustomizations:
          if (!callbackCustomizations)
            this.options.logger(
              'Info',
              'No code customizations - Please restart your agent to see them..',
            );

          // Ugly - But it will recall the sever to get new customizations then
          // applying nocodeCustomizer and rebuild no-code routes
          return callbackCustomizations();

        default:
          throw new Error(`Unsupported Server Event: ${type}`);
      }
    });
  }
}
