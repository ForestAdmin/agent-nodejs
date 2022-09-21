import ForestHttpApi from '../../../../src/agent/utils/forest-http-api';
import RenderingPermissionService from '../../../../src/agent/services/authorization/internal/rendering-permission';
import generateUserScope from '../../../../src/agent/services/authorization/internal/generate-user-scope';
import userPermissionsFactory from '../../__factories__/authorization/internal/user-permission';

jest.mock('../../../../src/agent/utils/forest-http-api', () => ({
  getRenderingPermissions: jest.fn(),
}));

jest.mock('../../../../src/agent/services/authorization/internal/generate-user-scope', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('RenderingPermissionService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  function setup() {
    const userPermission = userPermissionsFactory.mockAllMethods().build();
    const getUserInfoMock = userPermission.getUserInfo as jest.Mock;

    const getRenderingPermissionsMock = ForestHttpApi.getRenderingPermissions as jest.Mock;

    const options = {
      forestServerUrl: 'https://api.dev',
      envSecret: 'secret',
      isProduction: true,
      permissionsCacheDurationInSeconds: 1000,
    };
    const renderingPermission = new RenderingPermissionService(options, userPermission);

    return {
      userPermission,
      renderingPermission,
      getUserInfoMock,
      getRenderingPermissionsMock,
      options,
    };
  }

  describe('getScope', () => {
    it('should retrieve the users and rendering info, generate scope and return it', async () => {
      const { renderingPermission, getUserInfoMock, getRenderingPermissionsMock, options } =
        setup();

      const scope = { field: 'title', operator: 'NotContains', value: '[test]' };
      const team = { id: 1, name: 'dream' };
      const renderingPermissions = {
        team,
        collections: {
          books: {
            scope,
          },
        },
        stats: {},
      };

      const userInfo = {
        id: 42,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'janedoe@forestadmin.com',
        permissionLevel: 'Admin',
        tags: {},
        roleId: 33,
      };

      getRenderingPermissionsMock.mockResolvedValueOnce(renderingPermissions);
      getUserInfoMock.mockResolvedValueOnce(userInfo);

      const user = { id: 42, tags: {} };

      const expected = { foo: 'bar' };
      (generateUserScope as jest.Mock).mockReturnValueOnce(expected);

      const actual = await renderingPermission.getScope({
        renderingId: '42',
        collectionName: 'books',
        user,
      });

      expect(getRenderingPermissionsMock).toHaveBeenCalledWith('42', options);
      expect(getUserInfoMock).toHaveBeenCalledWith(42);

      expect(generateUserScope).toHaveBeenCalledWith(scope, team, userInfo);

      expect(actual).toBe(expected);
    });

    it('should retry to get the permissions if a collection does not exist', async () => {
      const { renderingPermission, getUserInfoMock, getRenderingPermissionsMock, options } =
        setup();

      const scope = { field: 'title', operator: 'NotContains', value: '[test]' };
      const team = { id: 1, name: 'dream' };
      const renderingPermissions1 = {
        team,
        collections: {},
        stats: {},
      };
      const renderingPermissions2 = {
        team,
        collections: {
          books: {
            scope,
          },
        },
        stats: {},
      };

      const userInfo = {
        id: 42,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'janedoe@forestadmin.com',
        permissionLevel: 'Admin',
        tags: {},
        roleId: 33,
      };

      getRenderingPermissionsMock.mockResolvedValueOnce(renderingPermissions1);
      getRenderingPermissionsMock.mockResolvedValueOnce(renderingPermissions2);
      getUserInfoMock.mockResolvedValue(userInfo);

      const user = { id: 42, tags: {} };

      const expected = { foo: 'bar' };
      (generateUserScope as jest.Mock).mockReturnValueOnce(expected);

      const actual = await renderingPermission.getScope({
        renderingId: '42',
        collectionName: 'books',
        user,
      });

      expect(getRenderingPermissionsMock).toHaveBeenCalledTimes(2);
      expect(getRenderingPermissionsMock).toHaveBeenCalledWith('42', options);
      expect(getUserInfoMock).toHaveBeenCalledWith(42);

      expect(generateUserScope).toHaveBeenCalledWith(scope, team, userInfo);

      expect(actual).toBe(expected);
    });

    it('should not retry more than once', async () => {
      const { renderingPermission, getUserInfoMock, getRenderingPermissionsMock } = setup();

      const team = { id: 1, name: 'dream' };
      const renderingPermissions = {
        team,
        collections: {},
        stats: {},
      };

      const userInfo = {
        id: 42,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'janedoe@forestadmin.com',
        permissionLevel: 'Admin',
        tags: {},
        roleId: 33,
      };

      getRenderingPermissionsMock.mockResolvedValue(renderingPermissions);
      getUserInfoMock.mockResolvedValue(userInfo);

      const user = { id: 42, tags: {} };

      const expected = { foo: 'bar' };
      (generateUserScope as jest.Mock).mockReturnValueOnce(expected);

      const actual = await renderingPermission.getScope({
        renderingId: '42',
        collectionName: 'books',
        user,
      });

      expect(getRenderingPermissionsMock).toHaveBeenCalledTimes(2);

      expect(generateUserScope).not.toHaveBeenCalled();

      expect(actual).toBe(null);
    });
  });
});
