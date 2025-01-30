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

const close = jest.fn();

jest.mock('eventsource', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addEventListener,
    once,
    close,
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
      expect(addEventListener).toHaveBeenCalledWith('open', expect.any(Function), { once: true });

      expect(addEventListener).toHaveBeenCalledWith('heartbeat', expect.any(Function), {
        once: true,
      });

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
      test('should not do anything', () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          { ...options, instantCacheRefresh: false },
          refreshEventsHandlerService,
        );

        eventsSubscriptionService.subscribeEvents();

        expect(addEventListener).not.toHaveBeenCalled();
      });
    });
  });

  describe('close', () => {
    test('should close current Event Source', async () => {
      const eventsSubscriptionService = factories.eventsSubscription.build();
      eventsSubscriptionService.subscribeEvents();

      eventsSubscriptionService.close();

      expect(close).toHaveBeenCalled();
    });

    describe('when server events are deactivated', () => {
      test('should not do anything', async () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          { ...options, instantCacheRefresh: false },
          refreshEventsHandlerService,
        );

        eventsSubscriptionService.close();

        expect(close).not.toHaveBeenCalled();
      });
    });

    describe('when no event source instantiated yet', () => {
      test('should not do anything', async () => {
        const eventsSubscriptionService = factories.eventsSubscription.build();

        eventsSubscriptionService.close();

        expect(close).not.toHaveBeenCalled();
      });
    });
  });

  describe('detectBuffering', () => {
    test('should log an error after the timeout', () => {
      const spy = jest.spyOn(global, 'setTimeout');
      const eventsSubscriptionService = new EventsSubscriptionService(
        options,
        refreshEventsHandlerService,
      );
      eventsSubscriptionService.subscribeEvents();

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 45000);

      const callback = spy.mock.calls[0][0];

      callback();

      expect(options.logger).toHaveBeenCalledWith(
        'Error',
        `Unable to detect ServerSentEvents Heartbeat.
        Forest Admin uses ServerSentEvents to ensure that permission cache is up to date.
        It seems that your agent does not receive events from our server, this may due to buffering of events from your reverse proxy. 
        https://docs.forestadmin.com/developer-guide-agents-nodejs/getting-started/install/troubleshooting
        `,
      );

      jest.clearAllMocks();
    });
  });

  describe('handleSeverEvents', () => {
    describe('on Heartbeat', () => {
      test('should clear heartbeat timeout', () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );
        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // eslint-disable-next-line no-underscore-dangle
        expect(eventsSubscriptionService.heartBeatTimeout._destroyed).toBeFalsy();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events['heartbeat']({});

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // eslint-disable-next-line no-underscore-dangle
        expect(eventsSubscriptionService.heartBeatTimeout._destroyed).toBeTruthy();
      });
    });

    describe('on RefreshUsers event', () => {
      test('should delegate to refreshEventsHandlerService', () => {
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
      test('should delegate to refreshEventsHandlerService', () => {
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
      test('should delegate to refreshEventsHandlerService', () => {
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
      test('should delegate to refreshEventsHandlerService', () => {
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
        test('should not do anything', () => {
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
    test('should add new open listener on first open event', () => {
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

    test('should refreshEverything using refreshEventsHandlerService on re-open', () => {
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
    describe('when error status is Not Found (404)', () => {
      test('should warn the user', () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        expect(() => events['error']({ status: 404 })).toThrow(
          'Forest Admin server failed to find the environment ' +
            'related to the envSecret you configured. ' +
            'Can you check that you copied it properly during initialization?',
        );
      });
    });

    test.each([502, 503, 504])(
      'should warn the user about reconnection when error status is %s',
      status => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events['error']({ status });

        expect(options.logger).toHaveBeenCalledWith(
          'Debug',
          'Server Event - Connection lost trying to reconnect…',
        );
      },
    );

    describe('other error case', () => {
      test('should warn with error message information the user', () => {
        const eventsSubscriptionService = new EventsSubscriptionService(
          options,
          refreshEventsHandlerService,
        );

        eventsSubscriptionService.subscribeEvents();

        // eslint-disable-next-line @typescript-eslint/dot-notation
        events['error']({
          status: 403,
          message: 'some error message that might help customer to track issues',
        });
        expect(options.logger).toHaveBeenCalledWith(
          'Warn',
          'Server Event - Error: {"status":403,"message":"some error message that' +
            ' might help customer to track issues"}',
        );
      });
    });
  });
});
