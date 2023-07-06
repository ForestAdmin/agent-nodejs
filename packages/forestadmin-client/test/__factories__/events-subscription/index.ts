import { Factory } from 'fishery';

import refreshEventsHandlerServiceFactory from './native-refresh-events-handler-service';
import EventsSubscriptionService from '../../../src/events-subscription';
import forestAdminClientOptions from '../forest-admin-client-options';

export class EventsSubscriptionServiceFactory extends Factory<EventsSubscriptionService> {
  mockAllMethods() {
    return this.afterBuild(service => {
      service.subscribeEvents = jest.fn();
      service.close = jest.fn();
    });
  }
}

const eventsSubscriptionServiceFactory = EventsSubscriptionServiceFactory.define(
  () =>
    new EventsSubscriptionService(
      forestAdminClientOptions.build(),
      refreshEventsHandlerServiceFactory.build(),
    ),
);

export default eventsSubscriptionServiceFactory;
