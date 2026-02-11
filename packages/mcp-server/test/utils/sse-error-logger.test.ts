import type { Response } from 'express';

import interceptResponseForErrorLogging from '../../src/utils/sse-error-logger';

function createMockResponse(): Response {
  const res = {
    statusCode: 200,
    write: jest.fn().mockReturnValue(true),
    end: jest.fn().mockReturnThis(),
  } as unknown as Response;

  return res;
}

describe('interceptResponseForErrorLogging', () => {
  let logger: jest.Mock;
  let res: Response;

  beforeEach(() => {
    logger = jest.fn();
    res = createMockResponse();
  });

  describe('SSE error logging (existing behavior)', () => {
    it('should log JSON-RPC errors from SSE data in write chunks', () => {
      interceptResponseForErrorLogging(res, logger);

      res.write('event: message\ndata: {"error":{"message":"Method not found"}}\n\n');

      expect(logger).toHaveBeenCalledWith('Error', 'Method not found');
    });

    it('should log tool errors from SSE data in write chunks', () => {
      interceptResponseForErrorLogging(res, logger);

      res.write(
        'event: message\ndata: {"result":{"isError":true,"content":[{"text":"tool failed"}]}}\n\n',
      );

      expect(logger).toHaveBeenCalledWith('Error', 'Tool error: tool failed');
    });

    it('should log JSON-RPC errors from the final chunk in end', () => {
      interceptResponseForErrorLogging(res, logger);

      res.end('event: message\ndata: {"error":{"message":"Internal error"}}\n\n');

      expect(logger).toHaveBeenCalledWith('Error', 'Internal error');
    });

    it('should not log for non-error SSE messages', () => {
      interceptResponseForErrorLogging(res, logger);

      res.write('event: message\ndata: {"result":{"content":[{"text":"ok"}]}}\n\n');

      expect(logger).not.toHaveBeenCalled();
    });

    it('should handle Buffer chunks', () => {
      interceptResponseForErrorLogging(res, logger);

      res.write(Buffer.from('event: message\ndata: {"error":{"message":"buf error"}}\n\n'));

      expect(logger).toHaveBeenCalledWith('Error', 'buf error');
    });
  });

  describe('HTTP 500 body logging', () => {
    it('should log the response body when status is 500', () => {
      interceptResponseForErrorLogging(res, logger);

      res.statusCode = 500;
      res.end('{"error":"Internal Server Error"}');

      expect(logger).toHaveBeenCalledWith(
        'Error',
        'HTTP 500 response body: {"error":"Internal Server Error"}',
      );
    });

    it('should log the response body when status is 502', () => {
      interceptResponseForErrorLogging(res, logger);

      res.statusCode = 502;
      res.end('Bad Gateway');

      expect(logger).toHaveBeenCalledWith('Error', 'HTTP 502 response body: Bad Gateway');
    });

    it('should collect chunks from write and end into the full body', () => {
      interceptResponseForErrorLogging(res, logger);

      res.write('{"error":');
      res.statusCode = 500;
      res.end('"server error"}');

      expect(logger).toHaveBeenCalledWith(
        'Error',
        'HTTP 500 response body: {"error":"server error"}',
      );
    });

    it('should not log body for 200 responses', () => {
      interceptResponseForErrorLogging(res, logger);

      res.end('{"result":"ok"}');

      expect(logger).not.toHaveBeenCalled();
    });

    it('should not log body for 404 responses', () => {
      interceptResponseForErrorLogging(res, logger);

      res.statusCode = 404;
      res.end('Not Found');

      expect(logger).not.toHaveBeenCalled();
    });

    it('should not log when 500 response has no body', () => {
      interceptResponseForErrorLogging(res, logger);

      res.statusCode = 500;
      res.end();

      expect(logger).not.toHaveBeenCalled();
    });

    it('should handle end called with a callback function only', () => {
      interceptResponseForErrorLogging(res, logger);

      res.statusCode = 500;
      const callback = jest.fn();
      res.end(callback);

      expect(logger).not.toHaveBeenCalled();
    });
  });

  describe('passthrough behavior', () => {
    it('should call original write with the same arguments', () => {
      const originalWrite = res.write;
      interceptResponseForErrorLogging(res, logger);

      res.write('chunk', 'utf8');

      expect(originalWrite).toHaveBeenCalledWith('chunk', 'utf8', undefined);
    });

    it('should call original end with the same arguments', () => {
      const originalEnd = res.end;
      interceptResponseForErrorLogging(res, logger);

      res.end('final', 'utf8');

      expect(originalEnd).toHaveBeenCalledWith('final', 'utf8', undefined);
    });

    it('should return the original write result', () => {
      interceptResponseForErrorLogging(res, logger);

      const result = res.write('data');

      expect(result).toBe(true);
    });
  });
});
