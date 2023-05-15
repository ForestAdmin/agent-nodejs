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

      expect(addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addEventListener).toHaveBeenCalledWith('open', expect.any(Function));

      expect(addEventListener).toHaveBeenCalledWith(
        ServerEventType.RefreshUsers,
        expect.any(Function),
      );
      expect(addEventListener).toHaveBeenCalledWith(
        ServerEventType.RefreshRoles,
        expect.any(Function),
      );
      expect(addEventListener).toHaveBeenCalledWith(
        ServerEventType.RefreshRenderings,
        expect.any(Function),
      );
      expect(addEventListener).toHaveBeenCalledWith(
        ServerEventType.RefreshRenderings,
        expect.any(Function),
      );
    });
  });

  describe('handleSeverEvents', () => {
    describe('on RefreshUsers event', () => {
      test('should delegate to refreshEventsHandlerService', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events[ServerEventType.RefreshUsers]({});

        expect(refreshEventsHandlerService.onRefreshUsers).toHaveBeenCalled();
      });
    });

    describe('on RefreshRoles event', () => {
      test('should delegate to refreshEventsHandlerService', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events[ServerEventType.RefreshRoles]({});

        expect(refreshEventsHandlerService.onRefreshRoles).toHaveBeenCalled();
      });
    });

    describe('on RefreshCustomizations event', () => {
      test('should delegate to refreshEventsHandlerService', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events[ServerEventType.RefreshCustomizations]({});

        expect(refreshEventsHandlerService.onRefreshCustomizations).toHaveBeenCalled();
      });
    });

    describe('on RefreshRenderings event', () => {
      test('should delegate to refreshEventsHandlerService', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );
        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events[ServerEventType.RefreshRenderings]({
          data: JSON.stringify({
            renderingIds: ['13', 24],
          }),
        });

        expect(refreshEventsHandlerService.onRefreshRenderings).toHaveBeenCalled();
        expect(refreshEventsHandlerService.onRefreshRenderings).toHaveBeenCalledWith(['13', 24]);
      });
    });
  });
});
