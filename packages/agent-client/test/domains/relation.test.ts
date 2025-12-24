import type HttpRequester from '../../src/http-requester';

import Relation from '../../src/domains/relation';

jest.mock('../../src/http-requester');

describe('Relation', () => {
  let httpRequester: jest.Mocked<HttpRequester>;

  beforeEach(() => {
    jest.clearAllMocks();
    httpRequester = {
      query: jest.fn(),
      stream: jest.fn(),
    } as any;
  });

  describe('list', () => {
    it('should call httpRequester.query with correct relationship path', async () => {
      const relation = new Relation('posts', 'users', 1, httpRequester);
      const expectedData = [{ id: 1, title: 'Post 1' }];
      httpRequester.query.mockResolvedValue(expectedData);

      const result = await relation.list();

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'get',
        path: '/forest/users/1/relationships/posts',
        query: expect.any(Object),
      });
      expect(result).toEqual(expectedData);
    });

    it('should handle string parent id', async () => {
      const relation = new Relation('posts', 'users', 'abc-123', httpRequester);
      httpRequester.query.mockResolvedValue([]);

      await relation.list();

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'get',
        path: '/forest/users/abc-123/relationships/posts',
        query: expect.any(Object),
      });
    });

    it('should pass options to query serializer', async () => {
      const relation = new Relation('posts', 'users', 1, httpRequester);
      httpRequester.query.mockResolvedValue([]);

      await relation.list({ search: 'title', pagination: { size: 5 } });

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'get',
        path: '/forest/users/1/relationships/posts',
        query: expect.objectContaining({ search: 'title' }),
      });
    });

    it('should return typed data', async () => {
      interface Post {
        id: number;
        title: string;
      }
      const relation = new Relation('posts', 'users', 1, httpRequester);
      const expectedData: Post[] = [{ id: 1, title: 'Post 1' }];
      httpRequester.query.mockResolvedValue(expectedData);

      const result = await relation.list<Post>();

      expect(result).toEqual(expectedData);
    });
  });

  describe('count', () => {
    it('should call httpRequester.query with correct relationship count path', async () => {
      const relation = new Relation('posts', 'users', 1, httpRequester);
      httpRequester.query.mockResolvedValue({ count: 42 });

      const result = await relation.count();

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'get',
        path: '/forest/users/1/relationships/posts/count',
        query: expect.any(Object),
      });
      expect(result).toBe(42);
    });

    it('should handle string parent id for count', async () => {
      const relation = new Relation('posts', 'users', 'abc-123', httpRequester);
      httpRequester.query.mockResolvedValue({ count: 10 });

      const result = await relation.count();

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'get',
        path: '/forest/users/abc-123/relationships/posts/count',
        query: expect.any(Object),
      });
      expect(result).toBe(10);
    });

    it('should pass options to query serializer for count', async () => {
      const relation = new Relation('posts', 'users', 1, httpRequester);
      httpRequester.query.mockResolvedValue({ count: 5 });

      await relation.count({ search: 'draft' });

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'get',
        path: '/forest/users/1/relationships/posts/count',
        query: expect.objectContaining({ search: 'draft' }),
      });
    });
  });
});
