import type HttpRequester from '../../src/http-requester';

import Segment from '../../src/domains/segment';

jest.mock('../../src/http-requester');

describe('Segment', () => {
  let httpRequester: jest.Mocked<HttpRequester>;

  beforeEach(() => {
    jest.clearAllMocks();
    httpRequester = {
      query: jest.fn(),
      stream: jest.fn(),
    } as any;
  });

  describe('with named segment', () => {
    let segment: Segment<any>;

    beforeEach(() => {
      segment = new Segment('active-users', 'users', httpRequester);
    });

    describe('list', () => {
      it('should call httpRequester.query with segment filter', async () => {
        const expectedData = [{ id: 1, name: 'John' }];
        httpRequester.query.mockResolvedValue(expectedData);

        const result = await segment.list();

        expect(httpRequester.query).toHaveBeenCalledWith({
          method: 'get',
          path: '/forest/users',
          query: expect.objectContaining({
            segment: 'active-users',
          }),
        });
        expect(result).toEqual(expectedData);
      });

      it('should merge options with segment filter', async () => {
        httpRequester.query.mockResolvedValue([]);

        await segment.list({ search: 'john', pagination: { size: 10 } });

        expect(httpRequester.query).toHaveBeenCalledWith({
          method: 'get',
          path: '/forest/users',
          query: expect.objectContaining({
            search: 'john',
            segment: 'active-users',
          }),
        });
      });
    });

    describe('exportCsv', () => {
      it('should call httpRequester.stream with segment filter', async () => {
        const mockStream = {} as any;
        httpRequester.stream.mockResolvedValue(undefined);

        await segment.exportCsv(mockStream);

        expect(httpRequester.stream).toHaveBeenCalledWith({
          path: '/forest/users.csv',
          contentType: 'text/csv',
          query: expect.objectContaining({
            segment: 'active-users',
          }),
          stream: mockStream,
        });
      });

      it('should include fields in header', async () => {
        const mockStream = {} as any;
        httpRequester.stream.mockResolvedValue(undefined);

        await segment.exportCsv(mockStream, { fields: ['id', 'name'] });

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
  });

  describe('with live query segment', () => {
    let segment: Segment<any>;
    const liveQueryOptions = {
      connectionName: 'main',
      query: 'SELECT * FROM users WHERE active = true',
    };

    beforeEach(() => {
      segment = new Segment(undefined, 'users', httpRequester, liveQueryOptions);
    });

    describe('list', () => {
      it('should call httpRequester.query with live query parameters', async () => {
        httpRequester.query.mockResolvedValue([]);

        await segment.list();

        expect(httpRequester.query).toHaveBeenCalledWith({
          method: 'get',
          path: '/forest/users',
          query: expect.objectContaining({
            segmentQuery: 'SELECT * FROM users WHERE active = true',
            connectionName: 'main',
          }),
        });
      });

      it('should merge options with live query parameters', async () => {
        httpRequester.query.mockResolvedValue([]);

        await segment.list({ search: 'john' });

        expect(httpRequester.query).toHaveBeenCalledWith({
          method: 'get',
          path: '/forest/users',
          query: expect.objectContaining({
            search: 'john',
            segmentQuery: 'SELECT * FROM users WHERE active = true',
            connectionName: 'main',
          }),
        });
      });
    });

    describe('exportCsv', () => {
      it('should call httpRequester.stream with live query parameters', async () => {
        const mockStream = {} as any;
        httpRequester.stream.mockResolvedValue(undefined);

        await segment.exportCsv(mockStream);

        expect(httpRequester.stream).toHaveBeenCalledWith({
          path: '/forest/users.csv',
          contentType: 'text/csv',
          query: expect.objectContaining({
            segmentQuery: 'SELECT * FROM users WHERE active = true',
            connectionName: 'main',
          }),
          stream: mockStream,
        });
      });
    });
  });
});
