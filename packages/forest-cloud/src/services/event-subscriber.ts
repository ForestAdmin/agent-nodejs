import type { NormalizedCacheObject } from 'apollo-cache-inmemory';

import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloClient } from 'apollo-client';
import { WebSocketLink } from 'apollo-link-ws';
import gql from 'graphql-tag';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import WebSocket from 'ws';

import { BusinessError } from '../errors';

const CUSTOMIZATION_FAILED_SUBSCRIPTION = gql`
  subscription FullHostedCustomizationFailed($publishId: String!) {
    fullHostedCustomizationFailed(publishId: $publishId) {
      error
    }
  }
`;

const CUSTOMIZATION_DEPLOYED_SUBSCRIPTION = gql`
  subscription FullHostedCustomizationDeployed($publishId: String!) {
    fullHostedCustomizationDeployed(publishId: $publishId) {
      timestamp
    }
  }
`;

export default class EventSubscriber {
  private readonly client: ApolloClient<NormalizedCacheObject>;
  private readonly subscriptionClient: SubscriptionClient;

  private failureSubscription: ZenObservable.Subscription;
  private deployedSubscription: ZenObservable.Subscription;

  constructor(subscriptionUrl: string, bearerToken: string) {
    this.subscriptionClient = new SubscriptionClient(
      subscriptionUrl,
      {
        connectionParams: {
          authToken: bearerToken,
        },
      },
      WebSocket,
    );
    const wsLink = new WebSocketLink(this.subscriptionClient);

    this.client = new ApolloClient({
      link: wsLink,
      cache: new InMemoryCache(),
    });
  }

  async subscribeToCodeCustomization(subscriptionId: string): Promise<{ error?: string }> {
    return new Promise((resolve, reject) => {
      this.failureSubscription = this.client
        .subscribe({
          query: CUSTOMIZATION_FAILED_SUBSCRIPTION,
          variables: { publishId: subscriptionId },
        })
        .subscribe(
          ({ data }) => resolve(data.fullHostedCustomizationFailed),
          error => reject(error),
        );

      this.deployedSubscription = this.client
        .subscribe({
          query: CUSTOMIZATION_DEPLOYED_SUBSCRIPTION,
          variables: { publishId: subscriptionId },
        })
        .subscribe(
          ({ data }) => resolve(data.fullHostedCustomizationDeployed),
          error => reject(error),
        );
    }).catch(error => {
      throw new BusinessError(
        `Error while listening to code customization events: ${(error as Error).message}`,
      );
    });
  }

  destroy() {
    try {
      this.failureSubscription?.unsubscribe();
      this.deployedSubscription?.unsubscribe();
      this.client.stop();
      this.subscriptionClient.close();
    } catch (e) {
      /* do nothing */
    }
  }
}
