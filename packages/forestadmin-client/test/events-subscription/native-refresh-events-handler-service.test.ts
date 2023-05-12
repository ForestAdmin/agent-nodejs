import NativeRefreshEventsHandlerService from '../../src/events-subscription/native-refresh-events-handler-service';
import * as factories from '../__factories__';

const events = {};
const addEventListener = jest.fn((event, callback) => {
  events[event] = callback;
});

jest.mock('eventsource', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addEventListener,
  })),
}));

describe('NativeRefreshEventsHandlerService', () => {
  beforeEach(() => jest.clearAllMocks());

  const actionPermission = factories.actionPermission.mockAllMethods().build();
  const usersPermission = factories.userPermission.mockAllMethods().build();
  const renderingPermission = factories.renderingPermission.mockAllMethods().build();

  describe('onRefreshUsers', () => {
    test('should invalidate users cache', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
      );

      refreshEventsHandler.onRefreshUsers();

      expect(usersPermission.invalidateCache).toHaveBeenCalled();

      expect(actionPermission.invalidateCache).not.toHaveBeenCalled();
      expect(renderingPermission.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('onRefreshRoles', () => {
    test('should invalidate roles cache', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
      );

      refreshEventsHandler.onRefreshRoles();

      expect(actionPermission.invalidateCache).toHaveBeenCalled();

      expect(usersPermission.invalidateCache).not.toHaveBeenCalled();
      expect(renderingPermission.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('onRefreshRenderings', () => {
    test('should invalidate renderings cache', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
      );

      const renderingsIds = ['13', 24];
      refreshEventsHandler.onRefreshRenderings(renderingsIds);

      expect(renderingPermission.invalidateCache).toHaveBeenCalledTimes(2);
      expect(renderingPermission.invalidateCache).toHaveBeenNthCalledWith(1, '13');
      expect(renderingPermission.invalidateCache).toHaveBeenNthCalledWith(2, 24);

      expect(actionPermission.invalidateCache).not.toHaveBeenCalled();
      expect(usersPermission.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('onRefreshCustomizations', () => {
    test('should emit RefreshCustomizations (it will call listener)', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
      );

      const spyEmit = jest.spyOn(refreshEventsHandler, 'emit');

      refreshEventsHandler.onRefreshCustomizations();

      expect(spyEmit).toHaveBeenCalled();
      expect(spyEmit).toHaveBeenCalledWith('RefreshCustomizations');

      expect(usersPermission.invalidateCache).not.toHaveBeenCalled();
      expect(actionPermission.invalidateCache).not.toHaveBeenCalled();
      expect(renderingPermission.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('refreshEverything', () => {
    test('should refresh all cached data', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
      );

      const spyEmit = jest.spyOn(refreshEventsHandler, 'emit');

      refreshEventsHandler.refreshEverything();

      expect(usersPermission.invalidateCache).toHaveBeenCalled();
      expect(actionPermission.invalidateCache).toHaveBeenCalled();
      expect(renderingPermission.invalidateAllCache).toHaveBeenCalled();

      expect(spyEmit).toHaveBeenCalled();
    });
  });
});
