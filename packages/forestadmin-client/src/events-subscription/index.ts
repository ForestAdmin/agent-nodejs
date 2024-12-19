import { EventSource } from 'eventsource';
import { Agent, fetch } from 'undici';

import {
  BaseEventsSubscriptionService,
  RefreshEventsHandlerService,
  ServerEvent,
  ServerEventType,
} from './types';
import { ForestAdminClientOptionsWithDefaults } from '../types';

export default class EventsSubscriptionService implements BaseEventsSubscriptionService {
  private eventSource: EventSource;

  constructor(
    private readonly options: ForestAdminClientOptionsWithDefaults,
    private readonly refreshEventsHandlerService: RefreshEventsHandlerService,
  ) {}

  async subscribeEvents(): Promise<void> {
    if (!this.options.instantCacheRefresh) {
      this.options.logger(
        'Debug',
        'Event source deactivated.. Use agent option [instantCacheRefresh=true] ' +
          'if you want to activate them',
      );

      return;
    }

    const eventSourceConfig = {
      // forest-secret-key act as the credential
      withCredentials: false,
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          headers: { ...init.headers, 'forest-secret-key': this.options.envSecret },
          dispatcher: new Agent({
            connect: {
              rejectUnauthorized: false,
            },
          }),
        }),
    };
    const url = new URL('/liana/v4/subscribe-to-events', this.options.forestServerUrl).toString();

    const eventSource = new EventSource(url, eventSourceConfig);
    // Override reconnect interval to 5 seconds
    // eventSource.reconnectInterval = 5000;

    eventSource.addEventListener('error', this.onEventError.bind(this));

    // Only listen after first open
    eventSource.addEventListener('open', () => this.onEventOpenAgain());
    eventSource.addEventListener(ServerEventType.RefreshUsers, async () =>
      this.refreshEventsHandlerService.refreshUsers(),
    );

    eventSource.addEventListener(ServerEventType.RefreshRoles, async () =>
      this.refreshEventsHandlerService.refreshRoles(),
    );

    eventSource.addEventListener(ServerEventType.RefreshRenderings, async (event: ServerEvent) =>
      this.handleSeverEventRefreshRenderings(event),
    );

    eventSource.addEventListener(ServerEventType.RefreshCustomizations, async () =>
      this.refreshEventsHandlerService.refreshCustomizations(),
    );

    this.eventSource = eventSource;
  }

  /**
   * Close the current EventSource
   */
  public close() {
    this.eventSource?.close();
  }

  private async handleSeverEventRefreshRenderings(event: ServerEvent) {
    if (!event.data) {
      this.options.logger('Debug', 'Server Event - RefreshRenderings missing required data.');

      return;
    }

    const { renderingIds } = JSON.parse(event.data as unknown as string);
    await this.refreshEventsHandlerService.refreshRenderings(renderingIds);
  }

  private onEventError(event: { type: string; status?: number; message?: string }) {
    const { status, message } = event;

    if ([502, 503, 504].includes(status)) {
      this.options.logger('Debug', 'Server Event - Connection lost trying to reconnect…');

      return;
    }

    if (status === 404) {
      throw new Error(
        'Forest Admin server failed to find the environment ' +
          'related to the envSecret you configured. ' +
          'Can you check that you copied it properly during initialization?',
      );
    }

    if (message) this.options.logger('Warn', `Server Event - Error: ${JSON.stringify(event)}`);
  }

  private onEventOpenAgain() {
    this.options.logger(
      'Debug',
      'Server Event - Open EventSource (SSE) connection with Forest Admin servers',
    );

    // Flush all previous data as we could have missed some events
    this.refreshEventsHandlerService.refreshEverything();
  }
}
