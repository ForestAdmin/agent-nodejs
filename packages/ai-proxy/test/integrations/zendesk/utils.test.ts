import { McpConnectionError } from '../../../src/errors';
import {
  assertResponseOk,
  getZendeskConfig,
  validateZendeskConfig,
} from '../../../src/integrations/zendesk/utils';

describe('zendesk/utils', () => {
  describe('getZendeskConfig', () => {
    it('should return baseUrl and headers with basic auth', () => {
      const config = { subdomain: 'mycompany', email: 'agent@test.com', apiToken: 'secret123' };

      const result = getZendeskConfig(config);

      const expectedAuth = Buffer.from('agent@test.com/token:secret123').toString('base64');
      expect(result).toEqual({
        baseUrl: 'https://mycompany.zendesk.com/api/v2',
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

      await expect(assertResponseOk(response, 'get ticket')).rejects.toThrow(
        'Zendesk get ticket failed (401): Invalid credentials',
      );
    });

    it('should throw with title from JSON body', async () => {
      const response = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ title: 'RecordNotFound' }),
      } as unknown as Response;

      await expect(assertResponseOk(response, 'get ticket')).rejects.toThrow(
        'Zendesk get ticket failed (404): RecordNotFound',
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

      await expect(assertResponseOk(response, 'create ticket')).rejects.toThrow(
        'Zendesk create ticket failed (502): Bad Gateway',
      );
    });
  });

  describe('validateZendeskConfig', () => {
    const config = { subdomain: 'mycompany', email: 'agent@test.com', apiToken: 'secret123' };

    beforeEach(() => jest.restoreAllMocks());

    it('should not throw when response is ok', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: 1 } }),
      } as Response);

      await expect(validateZendeskConfig(config)).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        'https://mycompany.zendesk.com/api/v2/users/me',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: expect.stringContaining('Basic ') }),
        }),
      );
    });

    it('should throw McpConnectionError when response has title', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        json: async () => ({ title: 'Unauthorized' }),
      } as Response);

      await expect(validateZendeskConfig(config)).rejects.toThrow(McpConnectionError);
      await expect(validateZendeskConfig(config)).rejects.toThrow(
        'Failed to validate Zendesk config: Unauthorized',
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

      await expect(validateZendeskConfig(config)).rejects.toThrow(
        'Failed to validate Zendesk config: Bad Gateway',
      );
    });

    it('should throw McpConnectionError using error.title as fallback', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        json: async () => ({ error: { title: 'Bad Request' } }),
      } as Response);

      await expect(validateZendeskConfig(config)).rejects.toThrow(
        'Failed to validate Zendesk config: Bad Request',
      );
    });
  });
});
