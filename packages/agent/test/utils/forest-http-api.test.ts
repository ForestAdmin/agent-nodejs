import { ConditionTreeLeaf, Operator } from '@forestadmin/datasource-toolkit';

import * as factories from '../__factories__';
import ForestHttpApi from '../../src/utils/forest-http-api';

describe('ForestHttpApi', () => {
  const options = factories.forestAdminHttpDriverOptions.build({
    isProduction: true,
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

    describe('when the call succeeds', () => {
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

    describe('when the call fails', () => {
      test('should throw an error', async () => {
        superagentMock.set.mockRejectedValue();

        const result = ForestHttpApi.getIpWhitelistConfiguration(options);
        await expect(result).rejects.toThrow(
          'An error occurred while retrieving your IP whitelist.',
        );
      });
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

    describe('when the call succeeds', () => {
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

    describe('when the call fails', () => {
      test('should throw an error', async () => {
        superagentMock.set.mockImplementation(() => {
          throw new Error();
        });

        const result = ForestHttpApi.getOpenIdIssuerMetadata(options);
        await expect(result).rejects.toThrow('Failed to fetch open-id issuer metadata');
      });
    });
  });

  describe('getUserAuthorizationInformations', () => {
    const user = {
      id: 1,
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
          id: '1',
          attributes: user,
        },
      },
    };
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

    describe('when the call succeeds', () => {
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
        });
      });
    });

    describe('when the call fails', () => {
      test('should throw an error', async () => {
        superagentMock.set.mockImplementation(() => ({
          set: () => {
            throw new Error();
          },
        }));

        const result = ForestHttpApi.getUserInformation(options, 1, 'tokenset');
        await expect(result).rejects.toThrow('Failed to retrieve authorization informations.');
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

    describe('when the call succeeds', () => {
      test('should return the correct value', async () => {
        superagentMock.set.mockResolvedValue({ body: { sendSchema: true } });

        const result = await ForestHttpApi.hasSchema(options, 'myHash');

        expect(result).toStrictEqual(false);
      });
    });

    describe('when the call fails', () => {
      test('should throw an error', async () => {
        superagentMock.set.mockRejectedValue(new Error());

        await expect(ForestHttpApi.hasSchema(options, 'myHash')).rejects.toThrow();
      });
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

    describe('when the call fails', () => {
      test('should throw an error if an error with no status code is dispatched', async () => {
        superagentMock.set.mockRejectedValue({ response: { status: 0 } });

        await expect(ForestHttpApi.uploadSchema(options, {})).rejects.toThrow(/Are you online/);
      });

      test('should throw an error if an error with 404 status is dispatched', async () => {
        superagentMock.set.mockRejectedValue({ response: { status: 404 } });

        await expect(ForestHttpApi.uploadSchema(options, {})).rejects.toThrow(
          /Cannot find the project related to the envSecret you configured/,
        );
      });

      test('should throw an error if an error with 503 status is dispatched', async () => {
        superagentMock.set.mockRejectedValue({ response: { status: 503 } });

        await expect(ForestHttpApi.uploadSchema(options, {})).rejects.toThrow(
          /Forest is in maintenance for a few minutes/,
        );
      });

      test('should throw an error if a unexpected error is dispatched', async () => {
        superagentMock.set.mockRejectedValue(new Error());

        await expect(ForestHttpApi.uploadSchema(options, {})).rejects.toThrow(
          /Please contact support@forestadmin.com/,
        );
      });
    });
  });

  describe('getPermissions', () => {
    test('when the call succeeds should return the correct value', async () => {
      superagentMock.query.mockResolvedValue({
        body: {
          meta: { rolesACLActivated: true },
          data: {
            collections: {
              books: {
                actions: {},
                collection: {
                  browseEnabled: [1],
                  readEnabled: [1],
                  editEnabled: [1],
                  addEnabled: [1],
                  deleteEnabled: [1],
                  exportEnabled: [1],
                },
              },
            },
            renderings: {
              '5': {
                books: {
                  scope: {
                    filter: { field: 'id', operator: 'not_equal', value: '$currentUser.team.id' },
                    dynamicScopesValues: { users: { '1': { '$currentUser.team.id': 1 } } },
                  },
                  segments: [],
                },
              },
            },
          },
          stats: {
            queries: [],
            leaderboards: [],
            lines: [],
            objectives: [],
            percentages: [],
            pies: [
              {
                type: 'Pie',
                filter: null,
                aggregator: 'Count',
                groupByFieldName: 'fullName',
                aggregateFieldName: null,
                sourceCollectionId: 'persons',
              },
            ],
            values: [],
          },
        },
      });

      const result = await ForestHttpApi.getPermissions(options, 5);

      expect(superagentMock.set).toHaveBeenCalledWith('forest-secret-key', 'myEnvSecret');
      expect(superagentMock.query).toHaveBeenCalledWith('renderingId=5');
      expect(superagentMock.get).toHaveBeenCalledWith('https://api.url/liana/v3/permissions');
      expect(result).toStrictEqual({
        actions: new Set(['chart:ab0e59989e6562233902327bdc9b8a67003841af']),
        collections: {
          books: {
            actionsByUser: {
              add: new Set([1]),
              browse: new Set([1]),
              delete: new Set([1]),
              edit: new Set([1]),
              export: new Set([1]),
              read: new Set([1]),
            },
            scopes: {
              conditionTree: new ConditionTreeLeaf('id', Operator.NotEqual, '$currentUser.team.id'),
              dynamicScopeValues: { '1': { '$currentUser.team.id': 1 } },
            },
          },
        },
      });
    });

    test('should throw an error when not using roles V3', async () => {
      superagentMock.query.mockResolvedValue({
        body: {
          meta: { rolesACLActivated: false },
        },
      });

      await expect(ForestHttpApi.getPermissions(options, 1)).rejects.toThrow(
        'Roles V2 are unsupported',
      );
    });

    test('should throw an error when the call fails', async () => {
      superagentMock.query.mockRejectedValue(new Error());

      await expect(ForestHttpApi.getPermissions(options, 1)).rejects.toThrow();
    });
  });
});
