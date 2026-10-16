import type { RefreshEventsHandlerService } from './types';
import type ActionPermissionService from '../permissions/action-permission';
import type RenderingPermissionService from '../permissions/rendering-permission';
import type UserPermissionService from '../permissions/user-permission';
import type { Logger } from '../types';

import EventEmitter from 'events';

export default class NativeRefreshEventsHandlerService implements RefreshEventsHandlerService {
  private readonly eventEmitter: EventEmitter;

  constructor(
    private readonly actionPermissionService: ActionPermissionService,
    private readonly usersPermissionService: UserPermissionService,
    private readonly renderingPermissionService: RenderingPermissionService,
    private readonly logger: Logger,
  ) {
    this.eventEmitter = new EventEmitter();
  }

  public refreshUsers() {
    this.usersPermissionService.invalidateCache();
  }

  public refreshRoles() {
    this.actionPermissionService.invalidateCache();
  }

  public refreshRenderings(renderingIds: (string | number)[]) {
    if (!renderingIds.length) {
      this.renderingPermissionService.invalidateAllCache();

      return;
    }

    for (const renderingId of renderingIds) {
      this.renderingPermissionService.invalidateCache(renderingId);
    }
  }

  public refreshCustomizations() {
    this.eventEmitter.emit('RefreshCustomizations');
  }

  public onRefreshCustomizations(handler: () => void | Promise<void>) {
    // EventEmitter drops the promise a listener returns, so a failing handler would reject unhandled.
    this.eventEmitter.on('RefreshCustomizations', async () => {
      try {
        await handler();
      } catch (error) {
        this.logger(
          'Error',
          `Server Event - refresh-customizations failed: ${error?.message ?? error}`,
        );
      }
    });
  }

  public refreshEverything() {
    this.usersPermissionService.invalidateCache();
    this.actionPermissionService.invalidateCache();
    this.renderingPermissionService.invalidateAllCache();

    // Emit RefreshCustomizations event
    this.eventEmitter.emit('RefreshCustomizations');
  }
}
