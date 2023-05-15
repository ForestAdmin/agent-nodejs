import EventSource from 'eventsource';

import { RefreshEventsHandlerService, ServerEvent, ServerEventType } from './types';
import { ForestAdminClientOptionsWithDefaults } from '../types';

export default class EventsSubscriptionService {
  constructor(
    private options: ForestAdminClientOptionsWithDefaults,
    private readonly refreshEventsHandlerService: RefreshEventsHandlerService,
  ) {}

  async subscribeEvents(): Promise<void> {
    if (!this.options.useServerEvents) {
      this.options.logger(
        'Debug',
        'Event source deactivated.. Use agent option [useServerEvents=true] ' +
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
      this.handleSeverEventRefreshUsers(),
    );

    source.addEventListener(ServerEventType.RefreshRoles, async () =>
      this.handleSeverEventRefreshRoles(),
    );

    source.addEventListener(ServerEventType.RefreshRenderings, async (event: ServerEvent) =>
      this.handleSeverEventRefreshRenderings(event),
    );

    source.addEventListener(ServerEventType.RefreshCustomizations, async () =>
      this.handleSeverEventRefreshCustomizations(),
    );
  }

  private async handleSeverEventRefreshUsers() {
    await this.refreshEventsHandlerService.onRefreshUsers();
  }

  private async handleSeverEventRefreshRoles() {
    await this.refreshEventsHandlerService.onRefreshRoles();
  }

  private async handleSeverEventRefreshRenderings(event: ServerEvent) {
    if (!event.data) {
      this.options.logger('Debug', 'Server Event - RefreshRenderings missing required data.');
    }

    const { renderingIds } = JSON.parse(event.data as unknown as string);
    await this.refreshEventsHandlerService.onRefreshRenderings(renderingIds);
  }

  private async handleSeverEventRefreshCustomizations() {
    await this.refreshEventsHandlerService.onRefreshCustomizations();
  }

  // Base handlers

  private onEventError(event: { type: string; status?: number; message?: string }) {
    if (event.status === 502) {
      this.options.logger(
        'Debug',
        'Server Event - Connection lost (ForestAdmin servers are restarting)',
      );

      return;
    }

    if (event.message)
      this.options.logger('Debug', `Server Event - Error: ${JSON.stringify(event)}`);
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
