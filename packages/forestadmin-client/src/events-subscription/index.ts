import EventSource from 'eventsource';

import { RefreshEventsHandlerService, ServerEvent, ServerEventType } from './types';
import { ForestAdminClientOptionsWithDefaults } from '../types';

export default class EventsSubscriptionService {
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

    source.addEventListener('open', () => this.onEventOpen());

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

  // Base handlers

  private onEventError(event: { type: string; status?: number; message?: string }) {
    if (event.status === 502) {
      this.options.logger('Debug', 'Server Event - Connection lost');

      return;
    }

    if (event.message)
      this.options.logger('Warn', `Server Event - Error: ${JSON.stringify(event)}`);
  }

  private onEventOpen() {
    this.options.logger(
      'Debug',
      'Server Event - Open EventSource (SSE) connection with Forest Admin servers',
    );

    // Flush all previous data as we could have missed some events
    this.refreshEventsHandlerService.refreshEverything();
  }
}
