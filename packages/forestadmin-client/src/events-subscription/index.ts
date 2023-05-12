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

    source.addEventListener('message', async (event: ServerEvent) => this.handleSeverEvents(event));
  }

  private async handleSeverEvents(event: ServerEvent) {
    const { type, data } = JSON.parse(event.data as unknown as string);

    this.options.logger('Debug', `Event - ${type}`);

    switch (type) {
      case ServerEventType.RefreshUsers:
        await this.refreshEventsHandlerService.onRefreshUsers();
        break;

      case ServerEventType.RefreshRoles:
        await this.refreshEventsHandlerService.onRefreshRoles();
        break;

      case ServerEventType.RefreshRenderings:
        await this.refreshEventsHandlerService.onRefreshRenderings(data as [string | number]);
        break;

      default:
        throw new Error(`Unsupported Server Event: ${type}`);
    }
  }

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

  private async onEventOpen() {
    this.options.logger(
      'Debug',
      'Server Event - Open EventSource (SSE) connection with Forest Admin servers',
    );

    // Flush all previous data as we could have missed some events
    this.refreshEventsHandlerService.refreshEverything();
  }
}
