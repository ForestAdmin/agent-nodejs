import type {
  BaseEventsSubscriptionService,
  RefreshEventsHandlerService,
  ServerEvent,
} from './types';
import type { ForestAdminClientOptionsWithDefaults } from '../types';

import EventSource from 'eventsource';

import { ServerEventType } from './types';

export default class EventsSubscriptionService implements BaseEventsSubscriptionService {
  private eventSource: EventSource;
  private heartBeatTimeout: NodeJS.Timeout;

  constructor(
    private readonly options: ForestAdminClientOptionsWithDefaults,
    private readonly refreshEventsHandlerService: RefreshEventsHandlerService,
  ) {}

  private detectBuffering() {
    clearTimeout(this.heartBeatTimeout);

    this.heartBeatTimeout = setTimeout(() => {
      this.options.logger(
        'Error',
        `Unable to detect ServerSentEvents Heartbeat.
        Forest Admin uses ServerSentEvents to ensure that permission cache is up to date.
        It seems that your agent does not receive events from our server, this may due to buffering of events from your networking infrastructure (reverse proxy).
        https://docs.forestadmin.com/developer-guide-agents-nodejs/getting-started/install/troubleshooting#invalid-permissions
        `,
      );
    }, 45000);
  }

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
      headers: { 'forest-secret-key': this.options.envSecret },
      https: {
        rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
      },
    };
    const url = new URL('/liana/v4/subscribe-to-events', this.options.forestServerUrl).toString();

    const eventSource = new EventSource(url, eventSourceConfig);
    // Override reconnect interval to 5 seconds
    eventSource.reconnectInterval = 5000;

    eventSource.addEventListener('error', this.onEventError.bind(this));

    // Only listen after first open
    eventSource.addEventListener(
      'open',
      () => eventSource.addEventListener('open', () => this.onEventOpenAgain()),
      { once: true },
    );

    eventSource.addEventListener(
      'heartbeat',
      () => {
        clearTimeout(this.heartBeatTimeout);
      },
      { once: true },
    );

    this.detectBuffering();

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
    clearTimeout(this.heartBeatTimeout);
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
