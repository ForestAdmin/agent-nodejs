import type { RefreshEventsHandlerService } from './types';
import type ActionPermissionService from '../permissions/action-permission';
import type RenderingPermissionService from '../permissions/rendering-permission';
import type UserPermissionService from '../permissions/user-permission';

import EventEmitter from 'events';

export default class NativeRefreshEventsHandlerService implements RefreshEventsHandlerService {
  private readonly eventEmitter: EventEmitter;

  constructor(
    private readonly actionPermissionService: ActionPermissionService,
    private readonly usersPermissionService: UserPermissionService,
    private readonly renderingPermissionService: RenderingPermissionService,
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
    for (const renderingId of renderingIds) {
      this.renderingPermissionService.invalidateCache(renderingId);
    }
  }

  public refreshCustomizations() {
    this.eventEmitter.emit('RefreshCustomizations');
  }

  public onRefreshCustomizations(handler: () => void | Promise<void>) {
    this.eventEmitter.on('RefreshCustomizations', handler);
  }

  public refreshEverything() {
    this.usersPermissionService.invalidateCache();
    this.actionPermissionService.invalidateCache();
    this.renderingPermissionService.invalidateAllCache();

    // Emit RefreshCustomizations event
    this.eventEmitter.emit('RefreshCustomizations');
  }
}
