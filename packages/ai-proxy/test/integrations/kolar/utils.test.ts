import { McpConnectionError } from '../../../src/errors';
import {
  assertResponseOk,
  getKolarConfig,
  validateKolarConfig,
} from '../../../src/integrations/kolar/utils';

describe('kolar/utils', () => {
  describe('getKolarConfig', () => {
    it('should return baseUrl and headers with basic auth', () => {
      const config = { username: 'admin', password: 'secret123' };

      const result = getKolarConfig(config);

      const expectedAuth = Buffer.from('admin:secret123').toString('base64');
      expect(result).toEqual({
        baseUrl: 'https://backend-partners.up.railway.app',
        headers: {
          Authorization: `Basic ${expectedAuth}`,
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('assertResponseOk', () => {
    it('should not throw when response is ok', async () => {
      const response = { ok: true } as Response;
      await expect(assertResponseOk(response, 'test')).resolves.toBeUndefined();
    });

    it('should throw with error field from JSON body', async () => {
      const response = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid credentials' }),
      } as unknown as Response;

      await expect(assertResponseOk(response, 'get screening result')).rejects.toThrow(
        'Kolar get screening result failed (401): Invalid credentials',
      );
    });

    it('should throw with message from JSON body', async () => {
      const response = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Alert not found' }),
      } as unknown as Response;

      await expect(assertResponseOk(response, 'get screening result')).rejects.toThrow(
        'Kolar get screening result failed (404): Alert not found',
      );
    });

    it('should fall back to statusText when JSON parsing fails', async () => {
      const response = {
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new Error('not json');
        },
      } as unknown as Response;

      await expect(assertResponseOk(response, 'create alert')).rejects.toThrow(
        'Kolar create alert failed (502): Bad Gateway',
      );
    });
  });

  describe('validateKolarConfig', () => {
    const config = { username: 'admin', password: 'secret123' };

    beforeEach(() => jest.restoreAllMocks());

    it('should not throw when response is ok', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);

      await expect(validateKolarConfig(config)).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        'https://backend-partners.up.railway.app/auth/verify',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: expect.stringContaining('Basic ') }),
        }),
      );
    });

    it('should throw McpConnectionError when response has message', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Unauthorized' }),
      } as Response);

      await expect(validateKolarConfig(config)).rejects.toThrow(McpConnectionError);
      await expect(validateKolarConfig(config)).rejects.toThrow(
        'Failed to validate Kolar config: Unauthorized',
      );
    });

    it('should fall back to statusText when response body is not JSON', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new Error('not json');
        },
      } as unknown as Response);

      await expect(validateKolarConfig(config)).rejects.toThrow(
        'Failed to validate Kolar config: Bad Gateway',
      );
    });
  });
});
