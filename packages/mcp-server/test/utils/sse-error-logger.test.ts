import type { Logger } from '../../src/server';
import type { Response } from 'express';

import interceptResponseForErrorLogging from '../../src/utils/sse-error-logger';

function createMockResponse(): Response {
  const res = {
    statusCode: 200,
    write: jest.fn(),
    end: jest.fn(),
  } as unknown as Response;

  return res;
}

describe('interceptResponseForErrorLogging', () => {
  let logger: jest.MockedFunction<Logger>;
  let res: Response;

  beforeEach(() => {
    logger = jest.fn();
    res = createMockResponse();
    interceptResponseForErrorLogging(res, logger);
  });

  describe('SSE error logging (existing behavior)', () => {
    it('should log JSON-RPC errors from SSE data on write', () => {
      res.write('event: message\ndata: {"error":{"message":"Something went wrong"}}\n\n');

      expect(logger).toHaveBeenCalledWith('Error', 'Something went wrong');
    });

    it('should log tool errors from SSE data on write', () => {
      const sseData =
        'event: message\ndata: {"result":{"isError":true,"content":[{"text":"Tool failed"}]}}\n\n';
      res.write(sseData);

      expect(logger).toHaveBeenCalledWith('Error', 'Tool error: Tool failed');
    });

    it('should log JSON-RPC errors from SSE data on end', () => {
      res.end('event: message\ndata: {"error":{"message":"Final error"}}\n\n');

      expect(logger).toHaveBeenCalledWith('Error', 'Final error');
    });

    it('should not log for non-SSE data on write', () => {
      res.write('just some plain text');

      expect(logger).not.toHaveBeenCalled();
    });
  });

  describe('HTTP 500 body logging', () => {
    it('should log response body when status is 500', () => {
      res.statusCode = 500;
      res.end('Error: stream failed');

      expect(logger).toHaveBeenCalledWith('Error', 'HTTP 500 response body: Error: stream failed');
    });

    it('should log concatenated body from write + end chunks', () => {
      res.statusCode = 500;
      res.write('Error: ');
      res.end('stream failed');

      expect(logger).toHaveBeenCalledWith('Error', 'HTTP 500 response body: Error: stream failed');
    });

    it('should log (empty) when 500 has no body', () => {
      res.statusCode = 500;
      res.end();

      expect(logger).toHaveBeenCalledWith('Error', 'HTTP 500 response body: (empty)');
    });

    it('should log body from multiple write chunks on 500', () => {
      res.statusCode = 502;
      res.write('chunk1');
      res.write('chunk2');
      res.end('chunk3');

      expect(logger).toHaveBeenCalledWith('Error', 'HTTP 502 response body: chunk1chunk2chunk3');
    });

    it('should handle Buffer chunks on end', () => {
      res.statusCode = 500;
      res.end(Buffer.from('Error: buffer content'));

      expect(logger).toHaveBeenCalledWith('Error', 'HTTP 500 response body: Error: buffer content');
    });

    it('should handle Buffer chunks on write', () => {
      res.statusCode = 500;
      res.write(Buffer.from('buffered '));
      res.end('end');

      expect(logger).toHaveBeenCalledWith('Error', 'HTTP 500 response body: buffered end');
    });

    it('should handle Uint8Array chunks on 500', () => {
      res.statusCode = 500;
      res.end(new Uint8Array(Buffer.from('Error: uint8 content')));

      expect(logger).toHaveBeenCalledWith('Error', 'HTTP 500 response body: Error: uint8 content');
    });

    it('should log all accumulated chunks even when status changes to 500 after write', () => {
      res.statusCode = 200;
      res.write('early chunk');
      res.statusCode = 500;
      res.end('late chunk');

      expect(logger).toHaveBeenCalledWith('Error', 'HTTP 500 response body: early chunklate chunk');
    });

    it('should not log body when status is 200', () => {
      res.statusCode = 200;
      res.write('some response data');
      res.end();

      expect(logger).not.toHaveBeenCalledWith('Error', expect.stringContaining('response body'));
    });

    it('should not log body when status is 400', () => {
      res.statusCode = 400;
      res.end('{"error":"bad request"}');

      expect(logger).not.toHaveBeenCalledWith('Error', expect.stringContaining('response body'));
    });

    it('should not log body when status is 499', () => {
      res.statusCode = 499;
      res.end('some body');

      expect(logger).not.toHaveBeenCalledWith('Error', expect.stringContaining('response body'));
    });
  });

  describe('passthrough behavior', () => {
    it('should call original write with same arguments and return its result', () => {
      const originalWrite = jest.fn().mockReturnValue(true);
      const mockRes = {
        statusCode: 200,
        write: originalWrite,
        end: jest.fn(),
      } as unknown as Response;
      interceptResponseForErrorLogging(mockRes, logger);

      const result = mockRes.write('data');

      expect(originalWrite).toHaveBeenCalledWith('data', undefined, undefined);
      expect(result).toBe(true);
    });

    it('should call original end with same arguments and return its result', () => {
      const originalEnd = jest.fn();
      const mockRes = {
        statusCode: 200,
        write: jest.fn(),
        end: originalEnd,
      } as unknown as Response;
      originalEnd.mockReturnValue(mockRes);
      interceptResponseForErrorLogging(mockRes, logger);

      const result = mockRes.end('final');

      expect(originalEnd).toHaveBeenCalledWith('final', undefined, undefined);
      expect(result).toBe(mockRes);
    });

    it('should treat function callback as non-body content and log (empty) on 500', () => {
      res.statusCode = 500;
      res.end(() => {});

      expect(logger).toHaveBeenCalledWith('Error', 'HTTP 500 response body: (empty)');
    });
  });
});
