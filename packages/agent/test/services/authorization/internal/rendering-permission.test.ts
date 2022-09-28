import { PermissionLevel } from '../../../../src/services/authorization/internal/types';
import {
  hashChartRequest,
  hashServerCharts,
} from '../../../../src/services/authorization/internal/hash-chart';
import ForestHttpApi from '../../../../src/utils/forest-http-api';
import RenderingPermissionService from '../../../../src/services/authorization/internal/rendering-permission';
import generateUserScope from '../../../../src/services/authorization/internal/generate-user-scope';
import userPermissionsFactory from '../../../__factories__/authorization/internal/user-permission';

jest.mock('../../../../src/utils/forest-http-api', () => ({
  getRenderingPermissions: jest.fn(),
}));

jest.mock('../../../../src/services/authorization/internal/generate-user-scope', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../../src/services/authorization/internal/hash-chart', () => ({
  __esModule: true,
  hashServerCharts: jest.fn(),
  hashChartRequest: jest.fn(),
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

    const hashServerChartsMock = hashServerCharts as jest.Mock;
    const hashChartRequestMock = hashChartRequest as jest.Mock;

    return {
      userPermission,
      renderingPermission,
      getUserInfoMock,
      getRenderingPermissionsMock,
      hashServerChartsMock,
      hashChartRequestMock,
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

  describe('canRetrieveChart', () => {
    it.each([PermissionLevel.Admin, PermissionLevel.Developer])(
      'should return true if the user is a %d',
      async permissionLevel => {
        const { renderingPermission, getUserInfoMock, getRenderingPermissionsMock, options } =
          setup();

        const userInfo = {
          id: 42,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@forest.com',
          permissionLevel,
        };

        getUserInfoMock.mockResolvedValue(userInfo);

        getRenderingPermissionsMock.mockResolvedValue({
          collections: {},
          stats: {},
          team: {},
        });

        const result = await renderingPermission.canRetrieveChart({
          renderingId: 60,
          chartRequest: { foo: 'bar' },
          userId: 42,
        });

        expect(result).toBe(true);

        expect(getUserInfoMock).toHaveBeenCalledWith(42);
        expect(getRenderingPermissionsMock).toHaveBeenCalledWith(60, options);
      },
    );

    describe('when the user is a simple user', () => {
      it('should return true if the chart is available in the list of defined charts', async () => {
        const {
          renderingPermission,
          getUserInfoMock,
          getRenderingPermissionsMock,
          options,
          hashServerChartsMock,
          hashChartRequestMock,
        } = setup();

        const userInfo = {
          id: 42,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@forest.com',
          permissionLevel: PermissionLevel.User,
        };

        getUserInfoMock.mockResolvedValue(userInfo);

        const stats = { lines: [{ type: 'Line' }] };
        getRenderingPermissionsMock.mockResolvedValue({
          collections: {},
          stats,
          team: {},
        });
        hashServerChartsMock.mockReturnValue(new Set(['HASH']));
        hashChartRequestMock.mockReturnValue('HASH');

        const result = await renderingPermission.canRetrieveChart({
          renderingId: 60,
          chartRequest: { foo: 'bar' },
          userId: 42,
        });

        expect(result).toBe(true);

        expect(getUserInfoMock).toHaveBeenCalledWith(42);
        expect(getRenderingPermissionsMock).toHaveBeenCalledWith(60, options);
        expect(hashChartRequestMock).toHaveBeenCalledWith({ foo: 'bar' });
        expect(hashServerChartsMock).toHaveBeenCalledWith(stats);
      });

      describe('when the user is not allowed with the first permissions', () => {
        it('should invalidate the cache and load permissions again', async () => {
          const {
            renderingPermission,
            getUserInfoMock,
            getRenderingPermissionsMock,
            options,
            hashServerChartsMock,
            hashChartRequestMock,
          } = setup();

          const userInfo = {
            id: 42,
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@forest.com',
            permissionLevel: PermissionLevel.User,
          };

          getUserInfoMock.mockResolvedValue(userInfo);

          const stats1 = { lines: [{ type: 'Line' }] };
          getRenderingPermissionsMock.mockResolvedValueOnce({
            collections: {},
            stats: stats1,
            team: {},
          });
          const stats2 = { lines: [{ type: 'Line' }] };
          getRenderingPermissionsMock.mockResolvedValueOnce({
            collections: {},
            stats: stats2,
            team: {},
          });
          hashServerChartsMock.mockReturnValueOnce(new Set(['HASH1']));
          hashServerChartsMock.mockReturnValueOnce(new Set(['HASH2']));
          hashChartRequestMock.mockReturnValue('HASH2');

          const result = await renderingPermission.canRetrieveChart({
            renderingId: 60,
            chartRequest: { foo: 'bar' },
            userId: 42,
          });

          expect(result).toBe(true);

          expect(getUserInfoMock).toHaveBeenCalledWith(42);
          expect(getUserInfoMock).toHaveBeenCalledTimes(2);
          expect(getRenderingPermissionsMock).toHaveBeenCalledWith(60, options);
          expect(getRenderingPermissionsMock).toHaveBeenCalledTimes(2);

          expect(hashChartRequestMock).toHaveBeenCalledWith({ foo: 'bar' });

          expect(hashServerChartsMock).toHaveBeenCalledWith(stats1);
          expect(hashServerChartsMock).toHaveBeenCalledWith(stats2);
          expect(hashServerChartsMock).toHaveBeenCalledTimes(2);
        });

        it('should return false if the user is still not allowed after 2nd load', async () => {
          const {
            renderingPermission,
            getUserInfoMock,
            getRenderingPermissionsMock,
            options,
            hashServerChartsMock,
            hashChartRequestMock,
          } = setup();

          const userInfo = {
            id: 42,
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@forest.com',
            permissionLevel: PermissionLevel.User,
          };

          getUserInfoMock.mockResolvedValue(userInfo);

          const stats = { lines: [{ type: 'Line' }] };
          getRenderingPermissionsMock.mockResolvedValue({
            collections: {},
            stats,
            team: {},
          });
          hashServerChartsMock.mockReturnValue(new Set(['HASH1']));
          hashChartRequestMock.mockReturnValue('HASH2');

          const result = await renderingPermission.canRetrieveChart({
            renderingId: 60,
            chartRequest: { foo: 'bar' },
            userId: 42,
          });

          expect(result).toBe(false);

          expect(getUserInfoMock).toHaveBeenCalledWith(42);
          expect(getUserInfoMock).toHaveBeenCalledTimes(2);
          expect(getRenderingPermissionsMock).toHaveBeenCalledWith(60, options);
          expect(getRenderingPermissionsMock).toHaveBeenCalledTimes(2);

          expect(hashChartRequestMock).toHaveBeenCalledWith({ foo: 'bar' });

          expect(hashServerChartsMock).toHaveBeenCalledWith(stats);
          expect(hashServerChartsMock).toHaveBeenCalledTimes(2);
        });
      });
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate the cache', async () => {
      const {
        renderingPermission,
        getUserInfoMock,
        getRenderingPermissionsMock,
        hashServerChartsMock,
        hashChartRequestMock,
      } = setup();

      const userInfo = {
        id: 42,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@forest.com',
        permissionLevel: PermissionLevel.User,
      };

      getUserInfoMock.mockResolvedValue(userInfo);

      const stats = { lines: [{ type: 'Line' }] };
      getRenderingPermissionsMock.mockResolvedValue({
        collections: {},
        stats,
        team: {},
      });
      hashServerChartsMock.mockReturnValue(new Set(['HASH']));
      hashChartRequestMock.mockReturnValue('HASH');

      const result1 = await renderingPermission.canRetrieveChart({
        renderingId: 60,
        chartRequest: { foo: 'bar' },
        userId: 42,
      });

      renderingPermission.invalidateCache(60);

      const result2 = await renderingPermission.canRetrieveChart({
        renderingId: 60,
        chartRequest: { foo: 'bar' },
        userId: 42,
      });
      expect(result1).toBe(true);
      expect(result2).toBe(true);

      expect(getRenderingPermissionsMock).toHaveBeenCalledTimes(2);
    });

    it('should not invalidate the cache of other renderings', async () => {
      const {
        renderingPermission,
        getUserInfoMock,
        getRenderingPermissionsMock,
        hashServerChartsMock,
        hashChartRequestMock,
      } = setup();

      const userInfo = {
        id: 42,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@forest.com',
        permissionLevel: PermissionLevel.User,
      };

      getUserInfoMock.mockResolvedValue(userInfo);

      const stats = { lines: [{ type: 'Line' }] };
      getRenderingPermissionsMock.mockResolvedValue({
        collections: {},
        stats,
        team: {},
      });
      hashServerChartsMock.mockReturnValue(new Set(['HASH']));
      hashChartRequestMock.mockReturnValue('HASH');

      const result1 = await renderingPermission.canRetrieveChart({
        renderingId: 60,
        chartRequest: { foo: 'bar' },
        userId: 42,
      });

      renderingPermission.invalidateCache(666);

      const result2 = await renderingPermission.canRetrieveChart({
        renderingId: 60,
        chartRequest: { foo: 'bar' },
        userId: 42,
      });
      expect(result1).toBe(true);
      expect(result2).toBe(true);

      expect(getRenderingPermissionsMock).toHaveBeenCalledTimes(1);
    });
  });
});
