import superagent from 'superagent';
import factories from '../__factories__';

import ForestHttpApi from '../../src/services/forest-http-api';

describe('ForestHttpApi', () => {
  const superagentMock = factories.superagent.mockAllMethods().build();
  jest.mock('superagent', () => superagentMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    describe('when forestServerUrl or envSecret are null', () => {
      it('should throw an error', () => {
        expect(() => new ForestHttpApi(null, null)).toThrow(
          'forestServerUrl: null and envSecret: null must be present.',
        );
      });
    });
  });

  describe('getIpWhitelist', () => {
    test('should fetch the correct end point with the env secret', async () => {
      superagent.set.mockResolvedValue({
        body: {
          attributes: {
            use_ip_whitelist: true,
            rules: [],
          },
        },
      });

      const service = new ForestHttpApi('http://api.url', 'myEnvSecret');
      await service.getIpWhitelist();

      expect(superagent.set).toHaveBeenCalledWith('forest-secret-key', 'myEnvSecret');
      expect(superagent.get).toHaveBeenCalledWith(
        new URL('http://api.url/liana/v1/ip-whitelist-rules'),
      );
    });

    describe('when the call succeeds', () => {
      test('should return the ip ranges and the isFeatureEnabled attributes', async () => {
        const ipRanges = [];
        const isFeatureEnabled = true;

        superagent.set.mockResolvedValue({
          body: {
            attributes: {
              use_ip_whitelist: isFeatureEnabled,
              rules: ipRanges,
            },
          },
        });

        const service = new ForestHttpApi('http://api.url', 'myEnvSecret');
        const result = await service.getIpWhitelist();

        expect(result).toStrictEqual({ isFeatureEnabled, ipRanges });
      });
    });

    describe('when the call fails', () => {
      test('should throw an error', async () => {
        superagent.set.mockImplementation(() => {
          throw new Error();
        });

        const service = new ForestHttpApi('http://api.url', 'myEnvSecret');
        await expect(service.getIpWhitelist()).rejects.toThrow(
          'An error occurred while retrieving your IP whitelist.',
        );
      });
    });
  });

  describe('getOpenIdConfiguration', () => {
    test('should fetch the correct end point with the env secret', async () => {
      superagent.set.mockResolvedValue({
        body: {},
      });

      const service = new ForestHttpApi('http://api.url', 'myEnvSecret');
      await service.getOpenIdConfiguration();

      expect(superagent.set).toHaveBeenCalledWith('forest-secret-key', 'myEnvSecret');
      expect(superagent.get).toHaveBeenCalledWith(
        new URL('http://api.url/oidc/.well-known/openid-configuration'),
      );
    });

    describe('when the call succeeds', () => {
      test('should return the openid configuration', async () => {
        const openidConfiguration = {
          registration_endpoint: 'http://fake-registration-endpoint.com',
        };
        superagent.set.mockResolvedValue({
          body: openidConfiguration,
        });

        const service = new ForestHttpApi('http://api.url', 'myEnvSecret');
        const result = await service.getOpenIdConfiguration();

        expect(result).toStrictEqual(openidConfiguration);
      });
    });

    describe('when the call fails', () => {
      test('should throw an error', async () => {
        superagent.set.mockImplementation(() => {
          throw new Error();
        });

        const service = new ForestHttpApi('http://api.url', 'myEnvSecret');
        await expect(service.getOpenIdConfiguration()).rejects.toThrow(
          'Failed to fetch openid-configuration',
        );
      });
    });
  });

  describe('getUserAuthorizationInformations', () => {
    const user = {
      id: '1',
      email: 'me@fake-email.com',
      first_name: 'John',
      last_name: 'Smith',
      teams: ['Operations'],
      role: 'developer',
      tags: [{ key: 'tag1', value: 'value1' }],
    };

    const body = {
      body: {
        data: {
          attributes: user,
          id: '1',
        },
      },
    };
    test('should fetch the correct end point with the env secret', async () => {
      const firstSetSpy = jest.fn().mockReturnValue(body);
      const secondSetSpy = jest.fn().mockImplementation(() => ({
        set: firstSetSpy,
      }));
      superagent.set = secondSetSpy;

      const service = new ForestHttpApi('http://api.url', 'myEnvSecret');
      await service.getUserAuthorizationInformations('1', 'tokenset');

      expect(firstSetSpy).toHaveBeenCalledWith('forest-secret-key', 'myEnvSecret');
      expect(secondSetSpy).toHaveBeenCalledWith('forest-token', 'tokenset');
      expect(superagent.get).toHaveBeenCalledWith(
        new URL('http://api.url/liana/v2/renderings/1/authorization'),
      );
    });

    describe('when the call succeeds', () => {
      test('should return the openid configuration', async () => {
        superagent.set.mockReturnValue({ ...body, set: () => body });

        const service = new ForestHttpApi('http://api.url', 'myEnvSecret');
        const result = await service.getUserAuthorizationInformations('1', 'tokenset');

        expect(result).toStrictEqual({
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          team: user.teams[0],
          role: user.role,
          tags: user.tags,
          renderingId: '1',
        });
      });
    });

    describe('when the call fails', () => {
      test('should throw an error', async () => {
        superagent.set.mockImplementation(() => ({
          set: () => {
            throw new Error();
          },
        }));

        const service = new ForestHttpApi('http://api.url', 'myEnvSecret');
        await expect(service.getUserAuthorizationInformations('1', 'tokenset')).rejects.toThrow(
          'Failed to retrieve authorization informations.',
        );
      });
    });
  });
});
