import { Factory } from 'fishery';

import NativeRefreshEventsHandlerService from '../../../src/events-subscription/native-refresh-events-handler-service';
import actionPermission from '../permissions/action-permission';
import renderingPermission from '../permissions/rendering-permission';
import userPermission from '../permissions/user-permission';

export class NativeRefreshEventsHandlerServiceFactory extends Factory<NativeRefreshEventsHandlerService> {
  mockAllMethods() {
    return this.afterBuild(service => {
      service.onRefreshUsers = jest.fn();
      service.onRefreshRoles = jest.fn();
      service.onRefreshRenderings = jest.fn();
      service.onRefreshCustomizations = jest.fn();
      service.refreshEverything = jest.fn();
    });
  }
}

const nativeRefreshEventsHandlerServiceFactory = NativeRefreshEventsHandlerServiceFactory.define(
  () =>
    new NativeRefreshEventsHandlerService(
      actionPermission.mockAllMethods().build(),
      userPermission.mockAllMethods().build(),
      renderingPermission.mockAllMethods().build(),
    ),
);

export default nativeRefreshEventsHandlerServiceFactory;
