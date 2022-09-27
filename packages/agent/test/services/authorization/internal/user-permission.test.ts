import ForestHttpApi from '../../../../src/utils/forest-http-api';
import UserPermissionService from '../../../../src/services/authorization/internal/user-permission';

jest.mock('../../../../src/utils/forest-http-api', () => ({
  __esModule: true,
  default: {
    getUsers: jest.fn(),
  },
}));

describe('UserPermission', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getUserInfo', () => {
    function setup() {
      const options = {
        isProduction: true,
        envSecret: '123',
        forestServerUrl: 'http://api',
        permissionsCacheDurationInSeconds: 15 * 60,
      };
      const userPermissions = new UserPermissionService(options);

      const getUsersMock = ForestHttpApi.getUsers as jest.Mock;

      return { userPermissions, options, getUsersMock };
    }

    it('should load users from the API the first time', async () => {
      const { userPermissions, options, getUsersMock } = setup();

      getUsersMock.mockResolvedValueOnce([
        { id: 42, email: 'alice@world.com' },
        { id: 43, email: 'bob@world.com' },
      ]);

      const userInfo = await userPermissions.getUserInfo(43);

      expect(userInfo).toStrictEqual({ id: 43, email: 'bob@world.com' });
      expect(getUsersMock).toHaveBeenCalledWith(options);
    });

    it('should reload the list of users if the given id does not exist', async () => {
      const { userPermissions, getUsersMock } = setup();
      getUsersMock.mockResolvedValueOnce([
        { id: 42, email: 'alice@world.com' },
        { id: 43, email: 'bob@world.com' },
      ]);
      getUsersMock.mockResolvedValueOnce([
        { id: 42, email: 'alice@world.com' },
        { id: 43, email: 'bob@world.com' },
        { id: 44, email: 'charlie@world.com' },
      ]);

      await userPermissions.getUserInfo(43);
      const userInfo = await userPermissions.getUserInfo(44);

      expect(getUsersMock).toHaveBeenCalledTimes(2);
      expect(userInfo).toEqual({ id: 44, email: 'charlie@world.com' });
    });

    it('should only load users once even if there are multiple calls to the service', async () => {
      const { userPermissions, getUsersMock } = setup();

      getUsersMock.mockResolvedValueOnce([
        { id: 42, email: 'alice@world.com' },
        { id: 43, email: 'bob@world.com' },
      ]);

      const [userInfo1, userInfo2] = await Promise.all([
        userPermissions.getUserInfo(43),
        userPermissions.getUserInfo(42),
      ]);

      expect(userInfo1).toStrictEqual({ id: 43, email: 'bob@world.com' });
      expect(userInfo2).toStrictEqual({ id: 42, email: 'alice@world.com' });
      expect(getUsersMock).toHaveBeenCalledTimes(1);
    });

    it('should return undefined when the user is not found', async () => {
      const { userPermissions, getUsersMock } = setup();

      getUsersMock.mockResolvedValueOnce([{ id: 42, email: 'alice@world.com' }]);

      const userInfo = await userPermissions.getUserInfo(43);

      expect(userInfo).toBeUndefined();
    });

    it('should reuse the cache if is recent', async () => {
      const { userPermissions, getUsersMock } = setup();

      getUsersMock.mockResolvedValueOnce([
        { id: 42, email: 'alice@world.com' },
        { id: 43, email: 'bob@world.com' },
      ]);

      jest.useFakeTimers().setSystemTime(new Date('2020-01-01T00:00:00.000Z'));

      await userPermissions.getUserInfo(43);

      jest.useFakeTimers().setSystemTime(new Date('2020-01-01T00:15:00.000Z'));
      const userInfo = await userPermissions.getUserInfo(43);

      expect(userInfo).toStrictEqual({ id: 43, email: 'bob@world.com' });
      expect(getUsersMock).toHaveBeenCalledTimes(1);
    });

    it('should refresh the cache if it is too old', async () => {
      const { userPermissions, getUsersMock } = setup();
      getUsersMock.mockResolvedValueOnce([
        { id: 42, email: 'alice@world.com' },
        { id: 43, email: 'bob@world.com' },
      ]);
      getUsersMock.mockResolvedValueOnce([
        { id: 42, email: 'alice@world.com' },
        { id: 43, email: 'bob2@world.com' },
      ]);

      jest.useFakeTimers().setSystemTime(new Date('2020-01-01T00:00:00.000Z'));

      await userPermissions.getUserInfo(43);

      jest.useFakeTimers().setSystemTime(new Date('2020-01-01T00:15:00.001Z'));
      const userInfo = await userPermissions.getUserInfo(43);

      expect(getUsersMock).toHaveBeenCalledTimes(2);
      expect(userInfo).toEqual({ id: 43, email: 'bob2@world.com' });
    });
  });
});
