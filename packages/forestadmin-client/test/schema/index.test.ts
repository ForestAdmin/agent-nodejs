import SchemaService from '../../src/schema';
import ServerUtils from '../../src/utils/server';
import * as factories from '../__factories__';

jest.mock('../../src/utils/server');

const serverQueryMock = ServerUtils.query as jest.Mock;

describe('SchemaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('the server does not know the schema', () => {
    beforeEach(() => {
      // return true when asked if the schema should be sent
      serverQueryMock.mockImplementation((options, method, route) =>
        route === '/forest/apimaps/hashcheck'
          ? Promise.resolve({ sendSchema: true })
          : Promise.resolve(),
      );
    });

    test('should post schema', async () => {
      const options = factories.forestAdminClientOptions.build();
      const schemaService = new SchemaService(options);
      const sent = await schemaService.postSchema({
        collections: [],
        meta: {
          liana: 'forest-nodejs-agent',
          liana_version: '1.0.0',
          liana_features: null,
          stack: { engine: 'nodejs', engine_version: '16.0.0' },
        },
      });

      expect(sent).toBe(true);
      expect(ServerUtils.query).toHaveBeenCalledTimes(2);
      expect(ServerUtils.query).toHaveBeenNthCalledWith(
        1,
        options,
        'post',
        '/forest/apimaps/hashcheck',
        {},
        expect.objectContaining({}),
      );
      expect(ServerUtils.query).toHaveBeenNthCalledWith(
        2,
        options,
        'post',
        '/forest/apimaps',
        {},
        expect.objectContaining({
          data: [],
          jsonapi: { version: '1.0' },
          meta: {
            liana: 'forest-nodejs-agent',
            liana_version: '1.0.0',
            liana_features: null,
            stack: { engine: 'nodejs', engine_version: '16.0.0' },
            schemaFileHash: expect.any(String),
          },
        }),
      );
      expect(options.logger).toHaveBeenCalledTimes(1);
      expect(options.logger).toHaveBeenCalledWith(
        'Info',
        'Schema was updated, sending new version (hash: f61f747c5f1de29c3aa2a93da76a723ee3f50785)',
      );
    });
  });

  describe('the server knows the schema', () => {
    beforeEach(() => {
      // return false when asked if the schema should be sent
      serverQueryMock.mockImplementation((options, method, route) =>
        route === '/forest/apimaps/hashcheck'
          ? Promise.resolve({ sendSchema: false })
          : Promise.resolve(),
      );
    });

    test('should not post schema if known by the server', async () => {
      const options = factories.forestAdminClientOptions.build();
      const schemaService = new SchemaService(options);
      const sent = await schemaService.postSchema({
        collections: [],
        meta: {
          liana: 'forest-nodejs-agent',
          liana_version: '1.0.0',
          liana_features: null,
          stack: { engine: 'nodejs', engine_version: '16.0.0' },
        },
      });

      expect(sent).toBe(false);
      expect(ServerUtils.query).toHaveBeenCalledTimes(1);
      expect(ServerUtils.query).toHaveBeenNthCalledWith(
        1,
        options,
        'post',
        '/forest/apimaps/hashcheck',
        {},
        expect.objectContaining({}),
      );
      expect(options.logger).toHaveBeenCalledTimes(1);
      expect(options.logger).toHaveBeenCalledWith(
        'Info',
        'Schema was not updated since last run (hash: f61f747c5f1de29c3aa2a93da76a723ee3f50785)',
      );
    });
  });
});
