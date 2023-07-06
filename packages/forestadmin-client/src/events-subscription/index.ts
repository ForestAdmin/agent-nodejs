import EventSource from 'eventsource';

import {
  BaseEventsSubscriptionService,
  RefreshEventsHandlerService,
  ServerEvent,
  ServerEventType,
} from './types';
import { ForestAdminClientOptionsWithDefaults } from '../types';

export default class EventsSubscriptionService implements BaseEventsSubscriptionService {
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
      headers: { 'forest-secret-key': this.options.envSecret },
      https: {
        rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
      },
    };
    const url = new URL('/liana/v4/subscribe-to-events', this.options.forestServerUrl).toString();

    const source = new EventSource(url, eventSourceConfig);

    source.addEventListener('error', this.onEventError.bind(this));

    // Only listen after first open
    source.once('open', () => source.addEventListener('open', () => this.onEventOpenAgain()));

    source.addEventListener(ServerEventType.RefreshUsers, async () =>
      this.refreshEventsHandlerService.refreshUsers(),
    );

    source.addEventListener(ServerEventType.RefreshRoles, async () =>
      this.refreshEventsHandlerService.refreshRoles(),
    );

    source.addEventListener(ServerEventType.RefreshRenderings, async (event: ServerEvent) =>
      this.handleSeverEventRefreshRenderings(event),
    );

    source.addEventListener(ServerEventType.RefreshCustomizations, async () =>
      this.refreshEventsHandlerService.refreshCustomizations(),
    );
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

    if (status === 404)
      throw new Error(
        'Forest Admin server failed to find the environment ' +
          'related to the envSecret you configured. ' +
          'Can you check that you copied it properly during initialization?',
      );

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
