import openidClient from 'openid-client';

import AuthService from '../../src/auth';
import ServerUtils from '../../src/utils/server';
import * as factories from '../__factories__';

jest.mock('../../src/utils/server');
const serverQueryMock = ServerUtils.query as jest.Mock;

jest.mock('openid-client', () => ({ Issuer: jest.fn() }));
const issuerMock = openidClient.Issuer as unknown as jest.Mock;

describe('AuthService', () => {
  beforeEach(() => {
    serverQueryMock.mockClear();
    issuerMock.mockClear();
  });

  test('getOpenIdClient should instanciate a Client', async () => {
    // Mock the openid-client Issuer
    const fakeConfig = {};
    const fakeClient = {};
    const registerMock = jest.fn().mockReturnValue(fakeClient);

    serverQueryMock.mockResolvedValueOnce(fakeConfig);
    issuerMock.mockReturnValue({ Client: { register: registerMock } });

    // Build an openIdClient
    const options = factories.forestAdminClientOptions.build();
    const service = new AuthService(options);
    const client = await service.getOpenIdClient();

    expect(client).toBe(fakeClient);
    expect(serverQueryMock).toHaveBeenCalledWith(
      options,
      'get',
      '/oidc/.well-known/openid-configuration',
    );
    expect(issuerMock).toHaveBeenCalledWith(fakeConfig);
    expect(registerMock).toBeCalledWith(
      { token_endpoint_auth_method: 'none' },
      { initialAccessToken: options.envSecret },
    );
  });

  test('getUserInfo should return the user info', async () => {
    serverQueryMock.mockResolvedValueOnce({
      data: {
        id: '1',
        attributes: {
          email: 'john.doe@email.com',
          first_name: 'John',
          last_name: 'Doe',
          teams: ['myTeam'],
          role: 'admin',
          permission_level: 'admin',
          tags: [{ key: 'tagKey', value: 'tagValue' }],
        },
      },
    });

    const options = factories.forestAdminClientOptions.build();
    const service = new AuthService(options);
    const userInfo = await service.getUserInfo(34, 'myAccessToken');

    expect(userInfo).toStrictEqual({
      id: 1,
      renderingId: 34,
      email: 'john.doe@email.com',
      firstName: 'John',
      lastName: 'Doe',
      team: 'myTeam',
      role: 'admin',
      permissionLevel: 'admin',
      tags: { tagKey: 'tagValue' },
    });

    expect(serverQueryMock).toHaveBeenCalledWith(
      options,
      'get',
      '/liana/v2/renderings/34/authorization',
      { 'forest-token': 'myAccessToken' },
    );
  });
});
