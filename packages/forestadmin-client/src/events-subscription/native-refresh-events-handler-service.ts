import EventEmitter from 'events';

import { RefreshEventsHandlerService, ServerEventType } from './types';
import ActionPermissionService from '../permissions/action-permission';
import RenderingPermissionService from '../permissions/rendering-permission';
import UserPermissionService from '../permissions/user-permission';

export default class NativeRefreshEventsHandlerService
  extends EventEmitter
  implements RefreshEventsHandlerService
{
  constructor(
    private readonly actionPermissionService: ActionPermissionService,
    private readonly usersPermissionService: UserPermissionService,
    private readonly renderingPermissionService: RenderingPermissionService,
  ) {
    super();
  }

  public onRefreshUsers() {
    this.usersPermissionService.invalidateCache();
  }

  public onRefreshRoles() {
    this.actionPermissionService.invalidateCache();
  }

  public onRefreshRenderings(renderingIds: (string | number)[]) {
    for (const renderingId of renderingIds)
      this.renderingPermissionService.invalidateCache(renderingId);
  }

  public onRefreshCustomizations() {
    this.emit(ServerEventType.RefreshCustomizations);
  }

  public ononRefreshCustomizations(listener: () => Promise<void>) {
    this.on(ServerEventType.RefreshCustomizations, listener);
  }

  public refreshEverything() {
    this.usersPermissionService.invalidateCache();
    this.actionPermissionService.invalidateCache();
    this.renderingPermissionService.invalidateAllCache();

    // Emit RefreshCustomizations event
    this.emit(ServerEventType.RefreshCustomizations);
  }
}
