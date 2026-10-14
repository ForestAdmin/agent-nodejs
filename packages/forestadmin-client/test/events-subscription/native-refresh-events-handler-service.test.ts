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
  const logger = jest.fn();

  describe('refreshUsers', () => {
    test('should invalidate users cache', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
        logger,
      );

      refreshEventsHandler.refreshUsers();

      expect(usersPermission.invalidateCache).toHaveBeenCalled();

      expect(actionPermission.invalidateCache).not.toHaveBeenCalled();
      expect(renderingPermission.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('refreshRoles', () => {
    test('should invalidate roles cache', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
        logger,
      );

      refreshEventsHandler.refreshRoles();

      expect(actionPermission.invalidateCache).toHaveBeenCalled();

      expect(usersPermission.invalidateCache).not.toHaveBeenCalled();
      expect(renderingPermission.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('refreshRenderings', () => {
    test('should invalidate renderings cache', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
        logger,
      );

      const renderingsIds = ['13', 24];
      refreshEventsHandler.refreshRenderings(renderingsIds);

      expect(renderingPermission.invalidateCache).toHaveBeenCalledTimes(2);
      expect(renderingPermission.invalidateCache).toHaveBeenNthCalledWith(1, '13');
      expect(renderingPermission.invalidateCache).toHaveBeenNthCalledWith(2, 24);

      expect(actionPermission.invalidateCache).not.toHaveBeenCalled();
      expect(usersPermission.invalidateCache).not.toHaveBeenCalled();
    });

    test('should invalidate every rendering when given an empty list', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
        logger,
      );

      refreshEventsHandler.refreshRenderings([]);

      expect(renderingPermission.invalidateAllCache).toHaveBeenCalledTimes(1);
      expect(renderingPermission.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('refreshCustomizations', () => {
    test('should called registered handlers', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
        logger,
      );

      const handler = jest.fn();
      refreshEventsHandler.onRefreshCustomizations(handler);
      expect(handler).not.toHaveBeenCalled();

      refreshEventsHandler.refreshCustomizations();

      expect(handler).toHaveBeenCalled();

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
        logger,
      );

      const handler = jest.fn();
      refreshEventsHandler.onRefreshCustomizations(handler);
      expect(handler).not.toHaveBeenCalled();

      refreshEventsHandler.refreshEverything();

      expect(usersPermission.invalidateCache).toHaveBeenCalled();
      expect(actionPermission.invalidateCache).toHaveBeenCalled();
      expect(renderingPermission.invalidateAllCache).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('onRefreshCustomizations', () => {
    test('should registered handlers', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
        logger,
      );

      const handler = jest.fn();
      const secondHandler = jest.fn();

      refreshEventsHandler.onRefreshCustomizations(handler);
      refreshEventsHandler.onRefreshCustomizations(secondHandler);

      // Actually calling them
      refreshEventsHandler.refreshCustomizations();

      expect(handler).toHaveBeenCalled();
      expect(secondHandler).toHaveBeenCalled();
    });

    test.each(['refreshCustomizations', 'refreshEverything'] as const)(
      'should log a failing handler instead of rejecting on %s',
      async method => {
        const refreshEventsHandler = new NativeRefreshEventsHandlerService(
          actionPermission,
          usersPermission,
          renderingPermission,
          logger,
        );
        const unhandledRejection = jest.fn();
        process.on('unhandledRejection', unhandledRejection);
        refreshEventsHandler.onRefreshCustomizations(() => Promise.reject(new Error('boom')));

        refreshEventsHandler[method]();
        await new Promise(resolve => {
          setImmediate(resolve);
        });
        process.off('unhandledRejection', unhandledRejection);

        expect(logger).toHaveBeenCalledWith(
          'Error',
          'Server Event - refresh-customizations failed: boom',
        );
        expect(unhandledRejection).not.toHaveBeenCalled();
      },
    );
  });
});
