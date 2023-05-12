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
  const refreshEventsHandlerService = factories.nativeRefreshEventsHandler.mockAllMethods().build();

  describe('subscribeEvents', () => {
    test('should add listener for message events', async () => {
      const eventsSubscriptionService = factories.eventsSubscription.build();

      eventsSubscriptionService.subscribeEvents();

      expect(addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('handleSeverEvents', () => {
    describe('on RefreshUsers event', () => {
      test('should invalidate users cache', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events['message']({
          data: JSON.stringify({
            type: ServerEventType.RefreshUsers,
          }),
        });

        expect(refreshEventsHandlerService.onRefreshUsers).toHaveBeenCalled();
      });
    });

    describe('on RefreshRoles event', () => {
      test('should invalidate roles cache', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events['message']({
          data: JSON.stringify({
            type: ServerEventType.RefreshRoles,
          }),
        });

        expect(refreshEventsHandlerService.onRefreshRoles).toHaveBeenCalled();
      });
    });

    describe('on RefreshRenderings event', () => {
      test('should invalidate renderings cache', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );
        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events['message']({
          data: JSON.stringify({
            type: ServerEventType.RefreshRenderings,
            data: ['13', 24],
          }),
        });

        expect(refreshEventsHandlerService.onRefreshRenderings).toHaveBeenCalled();
        expect(refreshEventsHandlerService.onRefreshRenderings).toHaveBeenCalledWith(['13', 24]);
      });
    });

    describe('on unknown event', () => {
      test('should throw error Unsupported Server Event', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );
        eventsSubscriptionService.subscribeEvents();

        await expect(() =>
          // eslint-disable-next-line @typescript-eslint/dot-notation
          events['message']({
            data: JSON.stringify({
              type: 'unknown',
            }),
          }),
        ).rejects.toThrow('Unsupported Server Event: unknown');

        expect(refreshEventsHandlerService.onRefreshUsers).not.toHaveBeenCalled();
        expect(refreshEventsHandlerService.onRefreshRoles).not.toHaveBeenCalled();
        expect(refreshEventsHandlerService.onRefreshRenderings).not.toHaveBeenCalled();
        expect(refreshEventsHandlerService.onRefreshCustomizations).not.toHaveBeenCalled();
      });
    });
  });
});
