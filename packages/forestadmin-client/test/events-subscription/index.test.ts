import EventsSubscriptionService from '../../src/events-subscription';
import { ServerEventType } from '../../src/events-subscription/types';
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

describe('EventsSubscriptionService', () => {
  beforeEach(() => jest.clearAllMocks());

  const options = factories.forestAdminClientOptions.build();
  const actionPermission = factories.actionPermission.mockAllMethods().build();
  const usersPermission = factories.userPermission.mockAllMethods().build();
  const renderingPermission = factories.renderingPermission.mockAllMethods().build();

  describe('subscribeEvents', () => {
    test('should add listener for message events', async () => {
      const eventsSubscriptionService = new EventsSubscriptionService(
        options,
        actionPermission,
        usersPermission,
        renderingPermission,
      );

      eventsSubscriptionService.subscribeEvents();

      expect(addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('handleSeverEvents', () => {
    describe('on RefreshUsers event', () => {
      test('should invalidate users cache', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          actionPermission,
          usersPermission,
          renderingPermission,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events['message']({
          data: {
            type: ServerEventType.RefreshUsers,
          },
        });

        expect(usersPermission.invalidateCache).toHaveBeenCalled();

        expect(actionPermission.invalidateCache).not.toHaveBeenCalled();
        expect(renderingPermission.invalidateCache).not.toHaveBeenCalled();
      });
    });

    describe('on RefreshRoles event', () => {
      test('should invalidate roles cache', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          actionPermission,
          usersPermission,
          renderingPermission,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events['message']({
          data: {
            type: ServerEventType.RefreshRoles,
          },
        });

        expect(actionPermission.invalidateCache).toHaveBeenCalled();

        expect(usersPermission.invalidateCache).not.toHaveBeenCalled();
        expect(renderingPermission.invalidateCache).not.toHaveBeenCalled();
      });
    });

    describe('on RefreshRenderings event', () => {
      test('should invalidate renderings cache', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          actionPermission,
          usersPermission,
          renderingPermission,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events['message']({
          data: {
            type: ServerEventType.RefreshRenderings,
            data: ['13', 24],
          },
        });

        expect(renderingPermission.invalidateCache).toHaveBeenCalledTimes(2);
        expect(renderingPermission.invalidateCache).toHaveBeenNthCalledWith(1, '13');
        expect(renderingPermission.invalidateCache).toHaveBeenNthCalledWith(2, 24);

        expect(actionPermission.invalidateCache).not.toHaveBeenCalled();
        expect(usersPermission.invalidateCache).not.toHaveBeenCalled();
      });

      test('should invalidate renderings cache empty event data', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          actionPermission,
          usersPermission,
          renderingPermission,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events['message']({
          data: {
            type: ServerEventType.RefreshRenderings,
            data: [],
          },
        });

        expect(usersPermission.invalidateCache).not.toHaveBeenCalled();
        expect(actionPermission.invalidateCache).not.toHaveBeenCalled();
        expect(renderingPermission.invalidateCache).not.toHaveBeenCalled();
      });
    });
  });
});
