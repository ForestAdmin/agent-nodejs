import superagent from 'superagent';

import HttpRequester from '../src/http-requester';

jest.mock('superagent');

describe('HttpRequester', () => {
  const mockSuperagent = superagent as jest.Mocked<typeof superagent>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance with token and options', () => {
      const requester = new HttpRequester('test-token', { url: 'https://api.example.com' });
      expect(requester).toBeInstanceOf(HttpRequester);
    });

    it('should create an instance with prefix', () => {
      const requester = new HttpRequester('test-token', {
        url: 'https://api.example.com',
        prefix: 'api/v1',
      });
      expect(requester).toBeInstanceOf(HttpRequester);
    });
  });

  describe('escapeUrlSlug', () => {
    it('should escape special characters in URL', () => {
      expect(HttpRequester.escapeUrlSlug('/path+with+plus')).toBe('/path\\+with\\+plus');
      expect(HttpRequester.escapeUrlSlug('/path?with?question')).toBe('/path\\?with\\?question');
      expect(HttpRequester.escapeUrlSlug('/path*with*asterisk')).toBe('/path\\*with\\*asterisk');
    });

    it('should encode URI components', () => {
      expect(HttpRequester.escapeUrlSlug('/path with spaces')).toBe('/path%20with%20spaces');
    });

    it('should return normal paths unchanged', () => {
      expect(HttpRequester.escapeUrlSlug('/normal/path')).toBe('/normal/path');
    });
  });

  describe('query', () => {
    let requester: HttpRequester;
    let mockRequest: any;

    beforeEach(() => {
      requester = new HttpRequester('test-token', { url: 'https://api.example.com' });

      mockRequest = {
        timeout: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        query: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };

      mockSuperagent.get = jest.fn().mockReturnValue(mockRequest);
      mockSuperagent.post = jest.fn().mockReturnValue(mockRequest);
      mockSuperagent.put = jest.fn().mockReturnValue(mockRequest);
      mockSuperagent.delete = jest.fn().mockReturnValue(mockRequest);
    });

    it('should make a GET request with correct headers', async () => {
      const responseBody = { data: { id: '1', type: 'test', attributes: { name: 'Test' } } };
      // Make the mockRequest act as a thenable with the resolved body
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(onFulfilled({ body: responseBody }));
      });

      await requester.query({ method: 'get', path: '/forest/users' });

      expect(mockSuperagent.get).toHaveBeenCalledWith('https://api.example.com/forest/users');
      expect(mockRequest.timeout).toHaveBeenCalledWith(10_000);
      expect(mockRequest.set).toHaveBeenCalledWith('Authorization', 'Bearer test-token');
      expect(mockRequest.set).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockRequest.query).toHaveBeenCalledWith({ timezone: 'Europe/Paris' });
    });

    it('should make a POST request with body', async () => {
      const body = { data: { attributes: { name: 'Test' } } };
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(onFulfilled({ body: {} }));
      });

      await requester.query({ method: 'post', path: '/forest/users', body });

      expect(mockSuperagent.post).toHaveBeenCalled();
      expect(mockRequest.send).toHaveBeenCalledWith(body);
    });

    it('should make a PUT request', async () => {
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(onFulfilled({ body: {} }));
      });

      await requester.query({ method: 'put', path: '/forest/users/1' });

      expect(mockSuperagent.put).toHaveBeenCalled();
    });

    it('should make a DELETE request', async () => {
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(onFulfilled({ body: {} }));
      });

      await requester.query({ method: 'delete', path: '/forest/users/1' });

      expect(mockSuperagent.delete).toHaveBeenCalled();
    });

    it('should use custom timeout if provided', async () => {
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(onFulfilled({ body: {} }));
      });

      await requester.query({ method: 'get', path: '/forest/users', maxTimeAllowed: 5000 });

      expect(mockRequest.timeout).toHaveBeenCalledWith(5000);
    });

    it('should use custom content type if provided', async () => {
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(onFulfilled({ body: {} }));
      });

      await requester.query({ method: 'get', path: '/forest/users', contentType: 'text/csv' });

      expect(mockRequest.set).toHaveBeenCalledWith('Content-Type', 'text/csv');
    });

    it('should include custom query parameters', async () => {
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(onFulfilled({ body: {} }));
      });

      await requester.query({
        method: 'get',
        path: '/forest/users',
        query: { page: 1, limit: 10 },
      });

      expect(mockRequest.query).toHaveBeenCalledWith({
        timezone: 'Europe/Paris',
        page: 1,
        limit: 10,
      });
    });

    it('should handle URL with prefix', async () => {
      const requesterWithPrefix = new HttpRequester('test-token', {
        url: 'https://api.example.com',
        prefix: 'api/v1',
      });

      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(onFulfilled({ body: {} }));
      });

      await requesterWithPrefix.query({ method: 'get', path: '/forest/users' });

      expect(mockSuperagent.get).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/forest/users',
      );
    });

    it('should throw error with response details on HTTP error', async () => {
      const error = {
        response: {
          error: { message: 'Not Found', status: 404 },
        },
      };
      mockRequest.then = jest.fn((_onFulfilled: any, onRejected: any) => {
        if (onRejected) {
          return Promise.resolve(onRejected(error));
        }

        return Promise.reject(error);
      });

      await expect(requester.query({ method: 'get', path: '/forest/users' })).rejects.toThrow();
    });

    it('should rethrow error if no response', async () => {
      const error = new Error('Network error');
      mockRequest.then = jest.fn((_onFulfilled: any, onRejected: any) => {
        if (onRejected) {
          return Promise.resolve(onRejected(error));
        }

        return Promise.reject(error);
      });

      await expect(requester.query({ method: 'get', path: '/forest/users' })).rejects.toThrow(
        'Network error',
      );
    });

    it('should deserialize JSON API response', async () => {
      const responseBody = {
        data: {
          id: '1',
          type: 'users',
          attributes: { name: 'John', email: 'john@example.com' },
        },
      };
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(onFulfilled({ body: responseBody }));
      });

      const result = await requester.query<any>({ method: 'get', path: '/forest/users' });

      expect(result).toHaveProperty('name', 'John');
      expect(result).toHaveProperty('email', 'john@example.com');
    });

    it('should return raw body if deserialization fails', async () => {
      const responseBody = { customData: 'value' };
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(onFulfilled({ body: responseBody }));
      });

      const result = await requester.query<any>({ method: 'get', path: '/forest/users' });

      expect(result).toEqual({ customData: 'value' });
    });
  });

  describe('queryWithFileSupport', () => {
    let requester: HttpRequester;
    let mockRequest: any;

    beforeEach(() => {
      requester = new HttpRequester('test-token', { url: 'https://api.example.com' });

      mockRequest = {
        timeout: jest.fn().mockReturnThis(),
        responseType: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        query: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };

      mockSuperagent.get = jest.fn().mockReturnValue(mockRequest);
      mockSuperagent.post = jest.fn().mockReturnValue(mockRequest);
      mockSuperagent.put = jest.fn().mockReturnValue(mockRequest);
      mockSuperagent.delete = jest.fn().mockReturnValue(mockRequest);
    });

    it('should make a POST request with responseType arraybuffer', async () => {
      const responseBody = { data: { id: '1', type: 'test', attributes: { name: 'Test' } } };
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(
          onFulfilled({
            body: Buffer.from(JSON.stringify(responseBody)),
            headers: {
              'content-type': 'application/json',
              'content-disposition': '',
            },
          }),
        );
      });

      await requester.queryWithFileSupport({
        method: 'post',
        path: '/forest/actions/test',
        body: { data: {} },
      });

      expect(mockSuperagent.post).toHaveBeenCalledWith(
        'https://api.example.com/forest/actions/test',
      );
      expect(mockRequest.responseType).toHaveBeenCalledWith('arraybuffer');
      expect(mockRequest.set).toHaveBeenCalledWith('Authorization', 'Bearer test-token');
      expect(mockRequest.set).toHaveBeenCalledWith('Content-Type', 'application/json');
    });

    it('should return json result type for JSON responses', async () => {
      const responseBody = {
        data: {
          id: '1',
          type: 'users',
          attributes: { name: 'John', email: 'john@example.com' },
        },
      };
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(
          onFulfilled({
            body: Buffer.from(JSON.stringify(responseBody)),
            headers: {
              'content-type': 'application/json',
              'content-disposition': '',
            },
          }),
        );
      });

      const result = await requester.queryWithFileSupport<any>({
        method: 'post',
        path: '/forest/actions/test',
      });

      expect(result.type).toBe('json');
      if (result.type === 'json') {
        expect(result.data).toHaveProperty('name', 'John');
        expect(result.data).toHaveProperty('email', 'john@example.com');
      }
    });

    it('should return file result type for attachment responses', async () => {
      const fileContent = Buffer.from('Hello, World!');
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(
          onFulfilled({
            body: fileContent,
            headers: {
              'content-type': 'text/plain',
              'content-disposition': 'attachment; filename="test.txt"',
            },
          }),
        );
      });

      const result = await requester.queryWithFileSupport({
        method: 'post',
        path: '/forest/actions/download',
      });

      expect(result.type).toBe('file');
      if (result.type === 'file') {
        expect(result.buffer).toEqual(fileContent);
        expect(result.mimeType).toBe('text/plain');
        expect(result.fileName).toBe('test.txt');
      }
    });

    it('should extract filename from Content-Disposition with quotes', async () => {
      const fileContent = Buffer.from('PDF content');
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(
          onFulfilled({
            body: fileContent,
            headers: {
              'content-type': 'application/pdf',
              'content-disposition': 'attachment; filename="report.pdf"',
            },
          }),
        );
      });

      const result = await requester.queryWithFileSupport({
        method: 'post',
        path: '/forest/actions/download',
      });

      expect(result.type).toBe('file');
      if (result.type === 'file') {
        expect(result.fileName).toBe('report.pdf');
      }
    });

    it('should extract filename from Content-Disposition without quotes', async () => {
      const fileContent = Buffer.from('CSV content');
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(
          onFulfilled({
            body: fileContent,
            headers: {
              'content-type': 'text/csv',
              'content-disposition': 'attachment; filename=export.csv',
            },
          }),
        );
      });

      const result = await requester.queryWithFileSupport({
        method: 'post',
        path: '/forest/actions/download',
      });

      expect(result.type).toBe('file');
      if (result.type === 'file') {
        expect(result.fileName).toBe('export.csv');
      }
    });

    it('should use default filename when Content-Disposition is missing', async () => {
      const fileContent = Buffer.from('Binary data');
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(
          onFulfilled({
            body: fileContent,
            headers: {
              'content-type': 'application/octet-stream',
              'content-disposition': 'attachment',
            },
          }),
        );
      });

      const result = await requester.queryWithFileSupport({
        method: 'post',
        path: '/forest/actions/download',
      });

      expect(result.type).toBe('file');
      if (result.type === 'file') {
        expect(result.fileName).toBe('download');
      }
    });

    it('should detect file response when content-type is not JSON or text', async () => {
      const fileContent = Buffer.from('Image data');
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(
          onFulfilled({
            body: fileContent,
            headers: {
              'content-type': 'image/png',
              'content-disposition': '',
            },
          }),
        );
      });

      const result = await requester.queryWithFileSupport({
        method: 'post',
        path: '/forest/actions/download',
      });

      expect(result.type).toBe('file');
      if (result.type === 'file') {
        expect(result.mimeType).toBe('image/png');
      }
    });

    it('should return raw JSON when deserialization fails', async () => {
      const responseBody = { customData: 'not JSON:API format', value: 42 };
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(
          onFulfilled({
            body: Buffer.from(JSON.stringify(responseBody)),
            headers: {
              'content-type': 'application/json',
              'content-disposition': '',
            },
          }),
        );
      });

      const result = await requester.queryWithFileSupport<any>({
        method: 'post',
        path: '/forest/actions/test',
      });

      expect(result.type).toBe('json');
      if (result.type === 'json') {
        expect(result.data).toEqual({ customData: 'not JSON:API format', value: 42 });
      }
    });

    it('should throw error with response details on HTTP error', async () => {
      const error = {
        response: {
          error: { message: 'Not Found', status: 404 },
        },
      };
      mockRequest.then = jest.fn((_onFulfilled: any, onRejected: any) => {
        if (onRejected) {
          return Promise.resolve(onRejected(error));
        }

        return Promise.reject(error);
      });

      await expect(
        requester.queryWithFileSupport({ method: 'post', path: '/forest/actions/test' }),
      ).rejects.toThrow();
    });

    it('should rethrow error if no response', async () => {
      const error = new Error('Network error');
      mockRequest.then = jest.fn((_onFulfilled: any, onRejected: any) => {
        if (onRejected) {
          return Promise.resolve(onRejected(error));
        }

        return Promise.reject(error);
      });

      await expect(
        requester.queryWithFileSupport({ method: 'post', path: '/forest/actions/test' }),
      ).rejects.toThrow('Network error');
    });

    it('should use custom timeout if provided', async () => {
      const responseBody = { success: true };
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(
          onFulfilled({
            body: Buffer.from(JSON.stringify(responseBody)),
            headers: {
              'content-type': 'application/json',
              'content-disposition': '',
            },
          }),
        );
      });

      await requester.queryWithFileSupport({
        method: 'post',
        path: '/forest/actions/test',
        maxTimeAllowed: 30000,
      });

      expect(mockRequest.timeout).toHaveBeenCalledWith(30000);
    });

    it('should include query parameters', async () => {
      const responseBody = { success: true };
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(
          onFulfilled({
            body: Buffer.from(JSON.stringify(responseBody)),
            headers: {
              'content-type': 'application/json',
              'content-disposition': '',
            },
          }),
        );
      });

      await requester.queryWithFileSupport({
        method: 'post',
        path: '/forest/actions/test',
        query: { customParam: 'value' },
      });

      expect(mockRequest.query).toHaveBeenCalledWith({
        timezone: 'Europe/Paris',
        customParam: 'value',
      });
    });

    it('should strip charset from content-type when extracting mime type', async () => {
      const fileContent = Buffer.from('Text content');
      mockRequest.then = jest.fn((onFulfilled: any) => {
        return Promise.resolve(
          onFulfilled({
            body: fileContent,
            headers: {
              'content-type': 'text/plain; charset=utf-8',
              'content-disposition': 'attachment; filename="file.txt"',
            },
          }),
        );
      });

      const result = await requester.queryWithFileSupport({
        method: 'post',
        path: '/forest/actions/download',
      });

      expect(result.type).toBe('file');
      if (result.type === 'file') {
        expect(result.mimeType).toBe('text/plain');
      }
    });
  });

  describe('stream', () => {
    let requester: HttpRequester;
    let mockRequest: any;
    let mockPipeResult: any;

    beforeEach(() => {
      requester = new HttpRequester('test-token', { url: 'https://api.example.com' });

      mockPipeResult = {
        on: jest.fn().mockImplementation(function (this: any, event: string, callback: () => void) {
          if (event === 'finish') {
            setImmediate(callback);
          }

          return this;
        }),
      };

      mockRequest = {
        timeout: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        query: jest.fn().mockReturnThis(),
        pipe: jest.fn().mockReturnValue(mockPipeResult),
      };

      mockSuperagent.get = jest.fn().mockReturnValue(mockRequest);
    });

    it('should stream data to the provided stream', async () => {
      const mockStream = {} as any;

      await requester.stream({
        path: '/forest/users.csv',
        contentType: 'text/csv',
        stream: mockStream,
      });

      expect(mockSuperagent.get).toHaveBeenCalledWith('https://api.example.com/forest/users.csv');
      expect(mockRequest.set).toHaveBeenCalledWith('Authorization', 'Bearer test-token');
      expect(mockRequest.set).toHaveBeenCalledWith('Accept', 'text/csv');
      expect(mockRequest.pipe).toHaveBeenCalledWith(mockStream);
    });

    it('should use custom timeout if provided', async () => {
      const mockStream = {} as any;

      await requester.stream({
        path: '/forest/users.csv',
        contentType: 'text/csv',
        stream: mockStream,
        maxTimeAllowed: 5000,
      });

      expect(mockRequest.timeout).toHaveBeenCalledWith(5000);
    });

    it('should include query parameters', async () => {
      const mockStream = {} as any;

      await requester.stream({
        path: '/forest/users.csv',
        contentType: 'text/csv',
        stream: mockStream,
        query: { filter: 'active' },
      });

      expect(mockRequest.query).toHaveBeenCalledWith({
        timezone: 'Europe/Paris',
        filter: 'active',
      });
    });

    it('should reject on error', async () => {
      const mockStream = {} as any;
      const error = new Error('Stream error');

      mockPipeResult.on = jest.fn().mockImplementation(function (
        this: any,
        event: string,
        callback: (err?: Error) => void,
      ) {
        if (event === 'error') {
          setImmediate(() => callback(error));
        }

        return this;
      });

      await expect(
        requester.stream({
          path: '/forest/users.csv',
          contentType: 'text/csv',
          stream: mockStream,
        }),
      ).rejects.toThrow('Stream error');
    });
  });
});
