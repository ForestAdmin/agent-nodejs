import ForestHttpApi from '../../src/utils/forest-http-api';
import * as factories from '../__factories__';

describe('ForestHttpApi', () => {
  const options = factories.forestAdminHttpDriverOptions.build({
    forestServerUrl: 'https://api.url',
    envSecret: 'myEnvSecret',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let superagentMock: any;

  beforeEach(() => {
    superagentMock = factories.superagent.mockAllMethods().build();
    jest.mock('superagent', () => superagentMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getIpWhitelist', () => {
    describe('the syntax of the rules', () => {
      it.each([
        { ipMinimum: '10.10.1.2', ipMaximum: '10.10.1.3' },
        { ip: '10.10.1.2' },
        { range: '10.10.1.2/24' },
      ])(`%s should be supported`, async rule => {
        const ipRules = [{ type: 1, ...rule }];
        const isFeatureEnabled = true;

        superagentMock.set.mockResolvedValue({
          body: {
            data: {
              attributes: {
                use_ip_whitelist: isFeatureEnabled,
                rules: ipRules,
              },
            },
          },
        });

        const result = await ForestHttpApi.getIpWhitelistConfiguration(options);

        expect(result).toStrictEqual({ isFeatureEnabled, ipRules });
      });
    });

    test('should fetch the correct end point with the env secret', async () => {
      superagentMock.set.mockResolvedValue({
        body: {
          data: {
            attributes: {
              use_ip_whitelist: true,
              rules: [],
            },
          },
        },
      });

      await ForestHttpApi.getIpWhitelistConfiguration(options);

      expect(superagentMock.set).toHaveBeenCalledWith('forest-secret-key', 'myEnvSecret');
      expect(superagentMock.get).toHaveBeenCalledWith(
        'https://api.url/liana/v1/ip-whitelist-rules',
      );
    });

    test('should return the ip rules and the isFeatureEnabled attributes', async () => {
      const ipRules = [{ type: 1, ip: '10.20.15.10' }];
      const isFeatureEnabled = true;

      superagentMock.set.mockResolvedValue({
        body: {
          data: {
            attributes: {
              use_ip_whitelist: isFeatureEnabled,
              rules: ipRules,
            },
          },
        },
      });

      const result = await ForestHttpApi.getIpWhitelistConfiguration(options);

      expect(result).toStrictEqual({ isFeatureEnabled, ipRules });
    });
  });

  describe('getOpenIdIssuerMetadata', () => {
    test('should fetch the correct end point with the env secret', async () => {
      superagentMock.set.mockResolvedValue({
        body: {},
      });

      await ForestHttpApi.getOpenIdIssuerMetadata(options);

      expect(superagentMock.set).toHaveBeenCalledWith('forest-secret-key', 'myEnvSecret');
      expect(superagentMock.get).toHaveBeenCalledWith(
        'https://api.url/oidc/.well-known/openid-configuration',
      );
    });

    test('should return the openid configuration', async () => {
      const openidConfiguration = {
        registration_endpoint: 'http://fake-registration-endpoint.com',
      };
      superagentMock.set.mockResolvedValue({
        body: openidConfiguration,
      });

      const result = await ForestHttpApi.getOpenIdIssuerMetadata(options);

      expect(result).toStrictEqual(openidConfiguration);
    });
  });

  describe('getUserInformation', () => {
    const user = {
      id: 1,
      email: 'me@fake-email.com',
      first_name: 'John',
      last_name: 'Smith',
      teams: ['Operations'],
      role: 'developer',
      tags: [{ key: 'tag1', value: 'value1' }],
      permission_level: 'developer',
    };
    const body = { body: { data: { id: '1', attributes: user } } };

    test('should fetch the correct end point with the env secret', async () => {
      const firstSetSpy = jest.fn().mockReturnValue(body);
      const secondSetSpy = jest.fn().mockImplementation(() => ({
        set: firstSetSpy,
      }));
      superagentMock.set = secondSetSpy;

      await ForestHttpApi.getUserInformation(options, 1, 'tokenset');

      expect(firstSetSpy).toHaveBeenCalledWith('forest-secret-key', 'myEnvSecret');
      expect(secondSetSpy).toHaveBeenCalledWith('forest-token', 'tokenset');
      expect(superagentMock.get).toHaveBeenCalledWith(
        'https://api.url/liana/v2/renderings/1/authorization',
      );
    });

    test('should return the user information', async () => {
      superagentMock.set.mockReturnValue({ ...body, set: () => body });

      const result = await ForestHttpApi.getUserInformation(options, 1, 'tokenset');

      expect(result).toStrictEqual({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        team: user.teams[0],
        role: user.role,
        tags: { tag1: 'value1' },
        renderingId: 1,
        permissionLevel: 'developer',
      });
    });
  });

  describe('hasSchema', () => {
    test('should fetch the correct end point with the env secret', async () => {
      superagentMock.set.mockResolvedValue({ body: {} });

      await ForestHttpApi.hasSchema(options, '123456abcdef');

      expect(superagentMock.set).toHaveBeenCalledWith('forest-secret-key', 'myEnvSecret');
      expect(superagentMock.send).toHaveBeenCalledWith({ schemaFileHash: '123456abcdef' });
      expect(superagentMock.post).toHaveBeenCalledWith('https://api.url/forest/apimaps/hashcheck');
    });

    test('should return the correct value', async () => {
      superagentMock.set.mockResolvedValue({ body: { sendSchema: true } });

      const result = await ForestHttpApi.hasSchema(options, 'myHash');

      expect(result).toStrictEqual(false);
    });
  });

  describe('uploadSchema', () => {
    test('should fetch the correct end point with the env secret', async () => {
      superagentMock.set.mockResolvedValue({ body: {} });

      await ForestHttpApi.uploadSchema(options, { meta: { info: 'i am a schema!' } });

      expect(superagentMock.set).toHaveBeenCalledWith('forest-secret-key', 'myEnvSecret');
      expect(superagentMock.send).toHaveBeenCalledWith({ meta: { info: 'i am a schema!' } });
      expect(superagentMock.post).toHaveBeenCalledWith('https://api.url/forest/apimaps');
    });

    describe('when the call succeeds', () => {
      test('should neither crash and nor print a warning', async () => {
        superagentMock.set.mockResolvedValue({ body: {} });

        await expect(ForestHttpApi.uploadSchema(options, {})).resolves.not.toThrowError();
      });
    });
  });

  describe('Forest server error handling', () => {
    describe('Failed to reach error', () => {
      test.each([0, 502])(
        'should throw an error if an error with status code %d is dispatched',
        async status => {
          superagentMock.set.mockRejectedValue({ response: { status } });

          await expect(ForestHttpApi.getIpWhitelistConfiguration(options)).rejects.toThrow(
            /Are you online/,
          );
        },
      );
    });

    test('should throw an error if an error with 404 status is dispatched', async () => {
      superagentMock.set.mockRejectedValue({ response: { status: 404 } });

      await expect(ForestHttpApi.getOpenIdIssuerMetadata(options)).rejects.toThrow(
        /failed to find the project related to the envSecret you configured/,
      );
    });

    test('should throw an error if an error with 503 status is dispatched', async () => {
      superagentMock.set.mockImplementation(() => {
        throw { name: 'error', message: 'request failed', response: { status: 503 } } as Error;
      });

      await expect(ForestHttpApi.getUserInformation(options, 1, '')).rejects.toThrow(
        /Forest is in maintenance for a few minutes/,
      );
    });

    test('should throw an error if a certificate error is dispatched', async () => {
      superagentMock.set.mockRejectedValue(new Error('invalid certificate'));

      await expect(ForestHttpApi.hasSchema(options, '')).rejects.toThrow(
        /ForestAdmin server TLS certificate cannot be verified/,
      );
    });

    test('should rethrow unexpected errors', async () => {
      superagentMock.set.mockRejectedValue(new Error('i am unexpected'));
      await expect(ForestHttpApi.uploadSchema(options, {})).rejects.toThrow('i am unexpected');
    });
  });
});
