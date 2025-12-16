import Collection from '../../src/domains/collection';
import HttpRequester from '../../src/http-requester';

jest.mock('../../src/http-requester');
jest.mock('../../src/action-fields/field-form-states');

describe('Collection', () => {
  let httpRequester: jest.Mocked<HttpRequester>;
  let collection: Collection;
  const actionEndpoints = {
    users: {
      sendEmail: { name: 'Send Email', endpoint: '/forest/actions/send-email' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    httpRequester = {
      query: jest.fn(),
      stream: jest.fn(),
    } as any;
    collection = new Collection('users', httpRequester, actionEndpoints);
  });

  describe('list', () => {
    it('should call httpRequester.query with correct parameters', async () => {
      const expectedData = [{ id: 1, name: 'John' }];
      httpRequester.query.mockResolvedValue(expectedData);

      const result = await collection.list();

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'get',
        path: '/forest/users',
        query: expect.any(Object),
      });
      expect(result).toEqual(expectedData);
    });

    it('should pass options to query serializer', async () => {
      httpRequester.query.mockResolvedValue([]);

      await collection.list({ search: 'john', pagination: { size: 10 } });

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'get',
        path: '/forest/users',
        query: expect.objectContaining({ search: 'john' }),
      });
    });
  });

  describe('search', () => {
    it('should call list with search option', async () => {
      const expectedData = [{ id: 1, name: 'John' }];
      httpRequester.query.mockResolvedValue(expectedData);

      const result = await collection.search('john');

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'get',
        path: '/forest/users',
        query: expect.objectContaining({ search: 'john' }),
      });
      expect(result).toEqual(expectedData);
    });
  });

  describe('count', () => {
    it('should return the count from the response', async () => {
      httpRequester.query.mockResolvedValue({ count: 42 });

      const result = await collection.count();

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'get',
        path: '/forest/users/count',
        query: expect.any(Object),
      });
      expect(result).toBe(42);
    });

    it('should pass options to query serializer', async () => {
      httpRequester.query.mockResolvedValue({ count: 10 });

      await collection.count({ search: 'john' });

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'get',
        path: '/forest/users/count',
        query: expect.objectContaining({ search: 'john' }),
      });
    });
  });

  describe('create', () => {
    it('should call httpRequester.query with POST method and correct body', async () => {
      const attributes = { name: 'John', email: 'john@example.com' };
      const expectedData = { id: 1, ...attributes };
      httpRequester.query.mockResolvedValue(expectedData);

      const result = await collection.create(attributes);

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/users',
        body: {
          data: {
            attributes,
            type: 'users',
          },
        },
      });
      expect(result).toEqual(expectedData);
    });
  });

  describe('update', () => {
    it('should call httpRequester.query with PUT method and correct body', async () => {
      const attributes = { name: 'John Updated' };
      const expectedData = { id: 1, name: 'John Updated' };
      httpRequester.query.mockResolvedValue(expectedData);

      const result = await collection.update(1, attributes);

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'put',
        path: '/forest/users/1',
        body: {
          data: {
            attributes,
            type: 'users',
            id: '1',
          },
        },
      });
      expect(result).toEqual(expectedData);
    });

    it('should handle string id', async () => {
      httpRequester.query.mockResolvedValue({});

      await collection.update('abc-123', { name: 'Test' });

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'put',
        path: '/forest/users/abc-123',
        body: expect.objectContaining({
          data: expect.objectContaining({ id: 'abc-123' }),
        }),
      });
    });
  });

  describe('delete', () => {
    it('should call httpRequester.query with DELETE method and correct body', async () => {
      httpRequester.query.mockResolvedValue({});

      await collection.delete([1, 2, 3]);

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'delete',
        path: '/forest/users',
        body: {
          data: {
            attributes: {
              collection_name: 'users',
              ids: ['1', '2', '3'],
            },
            type: 'action-requests',
          },
        },
      });
    });

    it('should handle string ids', async () => {
      httpRequester.query.mockResolvedValue({});

      await collection.delete(['abc', 'def']);

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'delete',
        path: '/forest/users',
        body: {
          data: {
            attributes: {
              collection_name: 'users',
              ids: ['abc', 'def'],
            },
            type: 'action-requests',
          },
        },
      });
    });
  });

  describe('exportCsv', () => {
    it('should call httpRequester.stream with correct parameters', async () => {
      const mockStream = {} as any;
      httpRequester.stream.mockResolvedValue(undefined);

      await collection.exportCsv(mockStream);

      expect(httpRequester.stream).toHaveBeenCalledWith({
        path: '/forest/users.csv',
        contentType: 'text/csv',
        query: expect.any(Object),
        stream: mockStream,
      });
    });

    it('should include projection in header query param', async () => {
      const mockStream = {} as any;
      httpRequester.stream.mockResolvedValue(undefined);

      await collection.exportCsv(mockStream, { projection: ['id', 'name'] });

      expect(httpRequester.stream).toHaveBeenCalledWith({
        path: '/forest/users.csv',
        contentType: 'text/csv',
        query: expect.objectContaining({
          header: JSON.stringify(['id', 'name']),
        }),
        stream: mockStream,
      });
    });
  });

  describe('segment', () => {
    it('should return a Segment instance', () => {
      const segment = collection.segment('active-users');
      expect(segment).toBeDefined();
    });
  });

  describe('liveQuerySegment', () => {
    it('should return a Segment instance with live query options', () => {
      const segment = collection.liveQuerySegment({
        connectionName: 'main',
        query: 'SELECT * FROM users WHERE active = true',
      });
      expect(segment).toBeDefined();
    });
  });

  describe('relation', () => {
    it('should return a Relation instance', () => {
      const relation = collection.relation('posts', 1);
      expect(relation).toBeDefined();
    });
  });

  describe('action', () => {
    it('should throw error if collection not found in action endpoints', async () => {
      const collectionWithoutActions = new Collection('unknown', httpRequester, {});

      await expect(collectionWithoutActions.action('test')).rejects.toThrow(
        'Collection unknown not found in schema',
      );
    });

    it('should throw error if action not found in collection', async () => {
      await expect(collection.action('unknownAction')).rejects.toThrow(
        'Action unknownAction not found in collection users',
      );
    });
  });
});
