import { McpConnectionError } from '../../../src/errors';
import { getZendeskConfig, validateZendeskConfig } from '../../../src/integrations/zendesk/utils';

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
