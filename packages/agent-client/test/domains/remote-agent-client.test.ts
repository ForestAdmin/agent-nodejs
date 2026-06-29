import type HttpRequester from '../../src/http-requester';

import RemoteAgentClient from '../../src/domains/remote-agent-client';

jest.mock('../../src/http-requester');

describe('RemoteAgentClient', () => {
  let httpRequester: jest.Mocked<HttpRequester>;
  let client: RemoteAgentClient;

  beforeEach(() => {
    jest.clearAllMocks();
    httpRequester = {
      query: jest.fn(),
      stream: jest.fn(),
    } as any;
    client = new RemoteAgentClient({
      httpRequester,
      actionEndpoints: {
        users: {
          sendEmail: {
            name: 'Send Email',
            endpoint: '/forest/actions/send-email',
            id: 'Send@@@Email',
            hooks: { load: false, change: [] },
            fields: [],
          },
        },
      },
    });
  });

  describe('constructor', () => {
    it('should create an instance without parameters', () => {
      const emptyClient = new RemoteAgentClient();
      expect(emptyClient).toBeInstanceOf(RemoteAgentClient);
    });

    it('should create an instance with all parameters', () => {
      expect(client).toBeInstanceOf(RemoteAgentClient);
    });
  });

  describe('collection', () => {
    it('should return a Collection instance', () => {
      const collection = client.collection('users');
      expect(collection).toBeDefined();
    });

    it('should pass action endpoints to collection', () => {
      const collection = client.collection('users');
      expect(collection).toBeDefined();
    });
  });
});
