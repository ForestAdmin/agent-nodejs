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
      const sent = await schemaService.postSchema([], 'forest-nodejs-agent', '1.0.0');

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
          meta: expect.objectContaining({
            liana: 'forest-nodejs-agent',
            liana_version: '1.0.0',
            stack: expect.objectContaining({ engine: 'nodejs' }),
          }),
        }),
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
      const sent = await schemaService.postSchema([], 'forest-nodejs-agent', '1.0.0');

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
    });
  });
});
