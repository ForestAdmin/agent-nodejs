import EventsSubscriptionService from '../../src/events-subscription';
import { ServerEventType } from '../../src/events-subscription/types';
import * as factories from '../__factories__';

const events = {};
const addEventListener = jest.fn((event, callback) => {
  events[event] = callback;
});

const once = jest.fn((event, callback) => {
  events[event] = callback;
});

jest.mock('eventsource', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addEventListener,
    once,
  })),
}));

describe('EventsSubscriptionService', () => {
  beforeEach(() => jest.clearAllMocks());

  const options = factories.forestAdminClientOptions.build();
  const refreshEventsHandlerService = factories.eventsHandler.mockAllMethods().build();

  describe('subscribeEvents', () => {
    test('should add listener for message events', async () => {
      const eventsSubscriptionService = factories.eventsSubscription.build();

      eventsSubscriptionService.subscribeEvents();

      expect(addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(once).toHaveBeenCalledWith('open', expect.any(Function));

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

    describe('when server events are deactivated', () => {
      test('should not do anything', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          { ...options, instantCacheRefresh: false },
          refreshEventsHandlerService,
        );

        eventsSubscriptionService.subscribeEvents();

        expect(addEventListener).not.toHaveBeenCalled();
      });
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

        expect(refreshEventsHandlerService.refreshUsers).toHaveBeenCalled();
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

        expect(refreshEventsHandlerService.refreshRoles).toHaveBeenCalled();
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

        expect(refreshEventsHandlerService.refreshCustomizations).toHaveBeenCalled();
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

        expect(refreshEventsHandlerService.refreshRenderings).toHaveBeenCalled();
        expect(refreshEventsHandlerService.refreshRenderings).toHaveBeenCalledWith(['13', 24]);
      });
      describe('on malformed event', () => {
        test('should not do anything', async () => {
          const eventsSubscriptionService = new EventsSubscriptionService(
            options,
            refreshEventsHandlerService,
          );
          eventsSubscriptionService.subscribeEvents();

          // eslint-disable-next-line @typescript-eslint/dot-notation
          events[ServerEventType.RefreshRenderings]({
            data: null,
          });

          expect(refreshEventsHandlerService.refreshRenderings).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('onEventOpenAgain', () => {
    test('should add new open listener on first open event', async () => {
      const eventsSubscriptionService = new EventsSubscriptionService(
        options,
        refreshEventsHandlerService,
      );

      eventsSubscriptionService.subscribeEvents();

      // eslint-disable-next-line @typescript-eslint/dot-notation
      events['open']();

      expect(addEventListener).toHaveBeenCalledWith('open', expect.any(Function));

      expect(refreshEventsHandlerService.refreshEverything).not.toHaveBeenCalled();
    });

    test('should refreshEverything using refreshEventsHandlerService on re-open', async () => {
      const eventsSubscriptionService = new EventsSubscriptionService(
        options,
        refreshEventsHandlerService,
      );

      eventsSubscriptionService.subscribeEvents();

      // eslint-disable-next-line @typescript-eslint/dot-notation
      events['open']();
      // eslint-disable-next-line @typescript-eslint/dot-notation
      events['open']();

      expect(refreshEventsHandlerService.refreshEverything).toHaveBeenCalled();

      expect(options.logger).toHaveBeenCalledWith(
        'Debug',
        'Server Event - Open EventSource (SSE) connection with Forest Admin servers',
      );
    });
  });

  describe('onEventError', () => {
    describe('when error status is Bad Gateway (502)', () => {
      test('should delegate to refreshEventsHandlerService', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events['error']({ status: 502 });

        expect(options.logger).toHaveBeenCalledWith('Debug', 'Server Event - Connection lost');
      });
    });

    describe('other error case', () => {
      test('should delegate to refreshEventsHandlerService', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events['error']({
          status: 404,
          message: 'some error message that might help customer to track issues',
        });
        expect(options.logger).toHaveBeenCalledWith(
          'Warn',
          'Server Event - Error: {"status":404,"message":"some error message that' +
            ' might help customer to track issues"}',
        );
      });
    });
  });
});
