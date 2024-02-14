import ApolloClient from 'apollo-client';
import { Observable } from 'apollo-client/util/Observable';
import gql from 'graphql-tag';
import { afterEach } from 'node:test';
import WebSocket from 'ws';

const mockSubscriptionClient = jest.fn();
const mockSubscriptionClientClose = jest.fn();

jest.mock('subscriptions-transport-ws', () => {
  return {
    __esModule: true,
    SubscriptionClient: mockSubscriptionClient.mockReturnValue({
      close: mockSubscriptionClientClose,
    }),
  };
});

// eslint-disable-next-line import/first
import EventSubscriber from '../../src/services/event-subscriber';

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

jest.mock('apollo-client');

describe('eventSubscriber', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create a subscription client', async () => {
      const subscriber = new EventSubscriber('subscriptionUrl', 'bearerToken');

      expect(subscriber).toBeTruthy();

      expect(mockSubscriptionClient).toHaveBeenCalled();
      expect(mockSubscriptionClient).toHaveBeenCalledWith(
        'subscriptionUrl',
        {
          connectionParams: {
            authToken: 'bearerToken',
          },
        },
        WebSocket,
      );
    });
  });

  describe('subscribeToCodeCustomization', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    describe('when the server emits a fullHostedCustomizationFailed', () => {
      it('should resolve with the error message', async () => {
        let observable;
        const messagePromise = new Promise(resolve => {
          observable = new Observable(observer => {
            observer.next({ data: { fullHostedCustomizationFailed: 'This is the error message' } });
            resolve(null);
          });
        });

        jest.mocked(ApolloClient.prototype.subscribe).mockReturnValueOnce(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          observable,
        );

        jest.mocked(ApolloClient.prototype.subscribe).mockReturnValueOnce(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          {
            subscribe: jest.fn(),
          },
        );

        const subscriber = new EventSubscriber('subscriptionUrl', 'bearerToken');

        const resultPromise = subscriber.subscribeToCodeCustomization('subscriptionId');
        await messagePromise;
        const result = await resultPromise;

        expect(result).toBeTruthy();
        expect(result).toEqual('This is the error message');
        expect(jest.mocked(ApolloClient.prototype.subscribe)).toHaveBeenCalledTimes(2);
        expect(jest.mocked(ApolloClient.prototype.subscribe)).toHaveBeenCalledWith({
          query: CUSTOMIZATION_FAILED_SUBSCRIPTION,
          variables: { publishId: 'subscriptionId' },
        });
        expect(jest.mocked(ApolloClient.prototype.subscribe)).toHaveBeenCalledWith({
          query: CUSTOMIZATION_DEPLOYED_SUBSCRIPTION,
          variables: { publishId: 'subscriptionId' },
        });
      });

      describe('when subscription fails', () => {
        it('should handle error', async () => {
          const failingSubscription = {
            subscribe: (success: () => void, onError: (error) => void) => {
              onError(new Error('Something bad'));
            },
          };

          jest.mocked(ApolloClient.prototype.subscribe).mockReturnValueOnce(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            failingSubscription,
          );

          const subscriber = new EventSubscriber('subscriptionUrl', 'bearerToken');

          await expect(subscriber.subscribeToCodeCustomization('subscriptionId')).rejects.toThrow(
            'Error while listening to code customization events: Something bad',
          );
        });
      });
    });

    describe('when the server emits a fullHostedCustomizationDeployed', () => {
      it('should resolve', async () => {
        let observable;
        const messagePromise = new Promise(resolve => {
          observable = new Observable(observer => {
            observer.next({ data: { fullHostedCustomizationDeployed: true } });
            resolve(null);
          });
        });

        jest.mocked(ApolloClient.prototype.subscribe).mockReturnValueOnce(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          {
            subscribe: jest.fn(),
          },
        );

        jest.mocked(ApolloClient.prototype.subscribe).mockReturnValueOnce(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          observable,
        );

        const subscriber = new EventSubscriber('subscriptionUrl', 'bearerToken');

        const resultPromise = subscriber.subscribeToCodeCustomization('subscriptionId');
        await messagePromise;
        const result = await resultPromise;

        expect(result).toBeTruthy();
        expect(result).toStrictEqual(true);
      });

      describe('when subscription fails', () => {
        it('should handle error', async () => {
          const failingSubscription = {
            subscribe: (success: () => void, onError: (error) => void) => {
              onError(new Error('Something bad'));
            },
          };

          jest.mocked(ApolloClient.prototype.subscribe).mockReturnValueOnce(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            {
              subscribe: jest.fn(),
            },
          );

          jest.mocked(ApolloClient.prototype.subscribe).mockReturnValueOnce(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            failingSubscription,
          );

          const subscriber = new EventSubscriber('subscriptionUrl', 'bearerToken');

          await expect(subscriber.subscribeToCodeCustomization('subscriptionId')).rejects.toThrow(
            'Error while listening to code customization events: Something bad',
          );
        });
      });
    });

    describe('when an error occurs', () => {
      it('should throw a business error', async () => {
        jest.mocked(ApolloClient.prototype.subscribe).mockImplementation(() => {
          throw new Error('Subscription topic does not exist');
        });

        const subscriber = new EventSubscriber('subscriptionUrl', 'bearerToken');

        await expect(subscriber.subscribeToCodeCustomization('subscriptionId')).rejects.toThrow(
          'Error while listening to code customization events: Subscription topic does not exist',
        );
      });
    });
  });

  describe('destroy', () => {
    it('should unsubscribe and close the client', async () => {
      const subscriber = new EventSubscriber('subscriptionUrl', 'bearerToken');

      subscriber.destroy();

      expect(jest.mocked(ApolloClient.prototype.stop)).toHaveBeenCalled();
      expect(mockSubscriptionClientClose).toHaveBeenCalled();
    });
  });
});
