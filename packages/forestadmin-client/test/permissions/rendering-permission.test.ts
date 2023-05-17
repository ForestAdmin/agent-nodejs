import { ChartType } from '../../src/charts/types';
import ChainedSQLQueryError from '../../src/permissions/errors/chained-sql-query-error';
import EmptySQLQueryError from '../../src/permissions/errors/empty-sql-query-error';
import NonSelectSQLQueryError from '../../src/permissions/errors/non-select-sql-query-error';
import { hashChartRequest, hashServerCharts } from '../../src/permissions/hash-chart';
import isSegmentQueryAllowed from '../../src/permissions/is-segment-query-authorized';
import RenderingPermissionService from '../../src/permissions/rendering-permission';
import { PermissionLevel, RawTree } from '../../src/permissions/types';
import verifySQLQuery from '../../src/permissions/verify-sql-query';
import ContextVariablesInjector from '../../src/utils/context-variables-injector';
import * as factories from '../__factories__';
import userPermissionsFactory from '../__factories__/permissions/user-permission';

jest.mock('../../src/permissions/hash-chart', () => ({
  __esModule: true,
  hashServerCharts: jest.fn(),
  hashChartRequest: jest.fn(),
}));

jest.mock('../../src/permissions/is-segment-query-authorized', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../src/permissions/verify-sql-query', () => ({
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

    const options = {
      forestServerUrl: 'https://api.dev',
      envSecret: 'secret',
      isProduction: true,
      instantCacheRefresh: false,
      permissionsCacheDurationInSeconds: 1000,
      logger: jest.fn(),
    };

    const serverInterface = factories.forestAdminServerInterface.build();
    const renderingPermission = new RenderingPermissionService(
      options,
      userPermission,
      serverInterface,
    );

    const hashServerChartsMock = hashServerCharts as jest.Mock;
    const hashChartRequestMock = hashChartRequest as jest.Mock;
    const verifySQLQueryMock = verifySQLQuery as jest.Mock;
    const isSegmentQueryAllowedMock = isSegmentQueryAllowed as jest.Mock;

    return {
      userPermission,
      renderingPermission,
      getUserInfoMock,
      serverInterface,
      hashServerChartsMock,
      hashChartRequestMock,
      verifySQLQueryMock,
      isSegmentQueryAllowedMock,
      options,
    };
  }

  describe('getScope', () => {
    it('should retrieve the users and rendering info, generate scope and return it', async () => {
      const { renderingPermission, getUserInfoMock, serverInterface, options } = setup();

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

      serverInterface.getRenderingPermissions = jest
        .fn()
        .mockResolvedValueOnce(renderingPermissions);
      getUserInfoMock.mockResolvedValueOnce(userInfo);

      const expected: RawTree = { field: 'test', operator: 'equal', value: 'me' };
      jest.spyOn(ContextVariablesInjector, 'injectContextInFilter').mockReturnValue(expected);

      const actual = await renderingPermission.getScope({
        renderingId: '42',
        collectionName: 'books',
        userId: 42,
      });

      expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(42, options);
      expect(getUserInfoMock).toHaveBeenCalledWith(42);

      expect(ContextVariablesInjector.injectContextInFilter).toHaveBeenCalledWith(
        scope,
        expect.objectContaining({ team, user: userInfo }),
      );

      expect(actual).toBe(expected);
    });

    it('should retry to get the permissions if a collection does not exist', async () => {
      const { renderingPermission, getUserInfoMock, serverInterface, options } = setup();

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

      serverInterface.getRenderingPermissions = jest
        .fn()
        .mockResolvedValueOnce(renderingPermissions1)
        .mockResolvedValueOnce(renderingPermissions2);
      getUserInfoMock.mockResolvedValue(userInfo);

      const expected: RawTree = { field: 'test', operator: 'equal', value: 'me' };
      jest.spyOn(ContextVariablesInjector, 'injectContextInFilter').mockReturnValueOnce(expected);

      const actual = await renderingPermission.getScope({
        renderingId: '42',
        collectionName: 'books',
        userId: '42',
      });

      expect(serverInterface.getRenderingPermissions).toHaveBeenCalledTimes(2);
      expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(42, options);
      expect(getUserInfoMock).toHaveBeenCalledWith('42');

      expect(ContextVariablesInjector.injectContextInFilter).toHaveBeenCalledWith(
        scope,
        expect.objectContaining({ team, user: userInfo }),
      );

      expect(actual).toBe(expected);
    });

    it('should not retry more than once', async () => {
      const { renderingPermission, getUserInfoMock, serverInterface } = setup();

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

      serverInterface.getRenderingPermissions = jest.fn().mockResolvedValue(renderingPermissions);
      getUserInfoMock.mockResolvedValue(userInfo);

      const expected: RawTree = { field: 'test', operator: 'equal', value: 'me' };
      jest.spyOn(ContextVariablesInjector, 'injectContextInFilter').mockReturnValue(expected);

      const actual = await renderingPermission.getScope({
        renderingId: '42',
        collectionName: 'books',
        userId: 42,
      });

      expect(serverInterface.getRenderingPermissions).toHaveBeenCalledTimes(2);

      expect(ContextVariablesInjector.injectContextInFilter).not.toHaveBeenCalled();

      expect(actual).toBe(null);
    });
  });

  describe('getUser', () => {
    it('should return the user info', async () => {
      const { renderingPermission, getUserInfoMock } = setup();
      const userInfo = {
        id: 42,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'janedoe@forestadmin.com',
        permissionLevel: 'Admin',
        tags: {},
        roleId: 33,
      };

      getUserInfoMock.mockResolvedValueOnce(userInfo);

      const user = await renderingPermission.getUser(123);

      expect(getUserInfoMock).toHaveBeenCalledWith(123);
      expect(user).toBe(userInfo);
    });
  });

  describe('getTeam', () => {
    it('should return the team', async () => {
      const { renderingPermission, serverInterface, options } = setup();

      const team = {
        name: 'team 1',
        id: 23,
      };
      serverInterface.getRenderingPermissions = jest.fn().mockResolvedValueOnce({
        collections: {},
        stats: {},
        team,
      });

      const teamReceived = await renderingPermission.getTeam(123);

      expect(teamReceived).toBe(team);
      expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(123, options);
    });
  });

  describe('canExecuteChart', () => {
    it.each([PermissionLevel.Admin, PermissionLevel.Developer, PermissionLevel.Editor])(
      'should return true if the user is a %d',
      async permissionLevel => {
        const { renderingPermission, getUserInfoMock, serverInterface, options } = setup();

        const userInfo = {
          id: 42,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@forest.com',
          permissionLevel,
        };

        getUserInfoMock.mockResolvedValue(userInfo);

        serverInterface.getRenderingPermissions = jest.fn().mockResolvedValue({
          collections: {},
          stats: {},
          team: {},
        });

        const result = await renderingPermission.canExecuteChart({
          renderingId: 60,
          chartRequest: {
            type: ChartType.Value,
            sourceCollectionName: 'jedi',
            aggregateFieldName: 'strength',
            aggregator: 'Sum',
          },
          userId: 42,
        });

        expect(result).toBe(true);

        expect(getUserInfoMock).toHaveBeenCalledWith(42);
        expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(60, options);
      },
    );

    describe('when the user is a simple user', () => {
      it('should return true if the chart is available in the list of defined charts', async () => {
        const {
          renderingPermission,
          getUserInfoMock,
          serverInterface,
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
        serverInterface.getRenderingPermissions = jest.fn().mockResolvedValue({
          collections: {},
          stats,
          team: {},
        });
        hashServerChartsMock.mockReturnValue(new Set(['HASH']));
        hashChartRequestMock.mockReturnValue('HASH');

        const result = await renderingPermission.canExecuteChart({
          renderingId: 60,
          chartRequest: {
            type: ChartType.Value,
            sourceCollectionName: 'jedi',
            aggregateFieldName: 'strength',
            aggregator: 'Sum',
          },
          userId: 42,
        });

        expect(result).toBe(true);

        expect(getUserInfoMock).toHaveBeenCalledWith(42);
        expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(60, options);
        expect(hashChartRequestMock).toHaveBeenCalledWith({
          type: ChartType.Value,
          sourceCollectionName: 'jedi',
          aggregateFieldName: 'strength',
          aggregator: 'Sum',
        });
        expect(hashServerChartsMock).toHaveBeenCalledWith(stats);
      });

      describe('with a query chart', () => {
        describe('when the query is empty', () => {
          it('should throw an error', async () => {
            const {
              renderingPermission,
              getUserInfoMock,
              serverInterface,
              options,
              hashServerChartsMock,
              hashChartRequestMock,
              verifySQLQueryMock,
            } = setup();

            const userInfo = {
              id: 42,
              firstName: 'Jane',
              lastName: 'Doe',
              email: 'jane@forest.com',
              permissionLevel: PermissionLevel.User,
            };

            getUserInfoMock.mockResolvedValue(userInfo);
            verifySQLQueryMock.mockRejectedValue(new EmptySQLQueryError());

            const stats = { queries: [{ type: 'Value', query: '  ' }] };
            serverInterface.getRenderingPermissions = jest.fn().mockResolvedValue({
              collections: {},
              stats,
              team: {},
            });
            hashServerChartsMock.mockReturnValue(new Set(['HASH']));
            hashChartRequestMock.mockReturnValue('HASH');

            const result = renderingPermission.canExecuteChart({
              renderingId: 60,
              chartRequest: {
                type: ChartType.Value,
                query: '  ',
              },
              userId: 42,
            });

            await expect(result).rejects.toThrow(EmptySQLQueryError);

            expect(getUserInfoMock).toHaveBeenCalledWith(42);
            expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(60, options);
            expect(hashChartRequestMock).toHaveBeenCalledWith({
              type: ChartType.Value,
              query: '  ',
            });
            expect(hashServerChartsMock).toHaveBeenCalledWith(stats);
          });
        });

        describe('when the query is chained', () => {
          it('should throw an error', async () => {
            const {
              renderingPermission,
              getUserInfoMock,
              serverInterface,
              options,
              hashServerChartsMock,
              hashChartRequestMock,
              verifySQLQueryMock,
            } = setup();

            const userInfo = {
              id: 42,
              firstName: 'Jane',
              lastName: 'Doe',
              email: 'jane@forest.com',
              permissionLevel: PermissionLevel.User,
            };

            getUserInfoMock.mockResolvedValue(userInfo);
            verifySQLQueryMock.mockRejectedValue(new ChainedSQLQueryError());

            const stats = { queries: [{ type: 'Value', query: '  ' }] };
            serverInterface.getRenderingPermissions = jest.fn().mockResolvedValue({
              collections: {},
              stats,
              team: {},
            });
            hashServerChartsMock.mockReturnValue(new Set(['HASH']));
            hashChartRequestMock.mockReturnValue('HASH');

            const result = renderingPermission.canExecuteChart({
              renderingId: 60,
              chartRequest: {
                type: ChartType.Value,
                query: 'SELECT count(*) as value FROM jedis; SELECT count(*) as value FROM siths;',
              },
              userId: 42,
            });

            await expect(result).rejects.toThrow(ChainedSQLQueryError);

            expect(getUserInfoMock).toHaveBeenCalledWith(42);
            expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(60, options);
            expect(hashChartRequestMock).toHaveBeenCalledWith({
              type: ChartType.Value,
              query: 'SELECT count(*) as value FROM jedis; SELECT count(*) as value FROM siths;',
            });
            expect(hashServerChartsMock).toHaveBeenCalledWith(stats);
          });
        });

        describe('when the query is an update', () => {
          it('should throw an error', async () => {
            const {
              renderingPermission,
              getUserInfoMock,
              serverInterface,
              options,
              hashServerChartsMock,
              hashChartRequestMock,
              verifySQLQueryMock,
            } = setup();

            const userInfo = {
              id: 42,
              firstName: 'Jane',
              lastName: 'Doe',
              email: 'jane@forest.com',
              permissionLevel: PermissionLevel.User,
            };

            getUserInfoMock.mockResolvedValue(userInfo);
            verifySQLQueryMock.mockRejectedValue(new NonSelectSQLQueryError());

            const stats = { queries: [{ type: 'Value', query: '  ' }] };
            serverInterface.getRenderingPermissions = jest.fn().mockResolvedValue({
              collections: {},
              stats,
              team: {},
            });
            hashServerChartsMock.mockReturnValue(new Set(['HASH']));
            hashChartRequestMock.mockReturnValue('HASH');

            const result = renderingPermission.canExecuteChart({
              renderingId: 60,
              chartRequest: {
                type: ChartType.Value,
                query: 'UPDATE jedis SET padawan_id = ?',
              },
              userId: 42,
            });

            await expect(result).rejects.toThrow(NonSelectSQLQueryError);

            expect(getUserInfoMock).toHaveBeenCalledWith(42);
            expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(60, options);
            expect(hashChartRequestMock).toHaveBeenCalledWith({
              type: ChartType.Value,
              query: 'UPDATE jedis SET padawan_id = ?',
            });
            expect(hashServerChartsMock).toHaveBeenCalledWith(stats);
          });
        });
      });

      describe('when the user is not allowed with the first permissions', () => {
        it('should invalidate the cache and load permissions again', async () => {
          const {
            renderingPermission,
            getUserInfoMock,
            serverInterface,
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
          const stats2 = { lines: [{ type: 'Line' }] };
          serverInterface.getRenderingPermissions = jest
            .fn()
            .mockResolvedValueOnce({
              collections: {},
              stats: stats1,
              team: {},
            })
            .mockResolvedValueOnce({
              collections: {},
              stats: stats2,
              team: {},
            });
          hashServerChartsMock.mockReturnValueOnce(new Set(['HASH1']));
          hashServerChartsMock.mockReturnValueOnce(new Set(['HASH2']));
          hashChartRequestMock.mockReturnValue('HASH2');

          const result = await renderingPermission.canExecuteChart({
            renderingId: 60,
            chartRequest: {
              type: ChartType.Value,
              sourceCollectionName: 'jedi',
              aggregateFieldName: 'strength',
              aggregator: 'Sum',
            },
            userId: 42,
          });

          expect(result).toBe(true);

          expect(getUserInfoMock).toHaveBeenCalledWith(42);
          expect(getUserInfoMock).toHaveBeenCalledTimes(2);
          expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(60, options);
          expect(serverInterface.getRenderingPermissions).toHaveBeenCalledTimes(2);

          expect(hashChartRequestMock).toHaveBeenCalledWith({
            type: ChartType.Value,
            sourceCollectionName: 'jedi',
            aggregateFieldName: 'strength',
            aggregator: 'Sum',
          });

          expect(hashServerChartsMock).toHaveBeenCalledWith(stats1);
          expect(hashServerChartsMock).toHaveBeenCalledWith(stats2);
          expect(hashServerChartsMock).toHaveBeenCalledTimes(2);
        });

        it('should return false if the user is still not allowed after 2nd load', async () => {
          const {
            renderingPermission,
            getUserInfoMock,
            serverInterface,
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
          serverInterface.getRenderingPermissions = jest.fn().mockResolvedValue({
            collections: {},
            stats,
            team: {},
          });
          hashServerChartsMock.mockReturnValue(new Set(['HASH1']));
          hashChartRequestMock.mockReturnValue('HASH2');

          const result = await renderingPermission.canExecuteChart({
            renderingId: 60,
            chartRequest: {
              type: ChartType.Value,
              sourceCollectionName: 'jedi',
              aggregateFieldName: 'strength',
              aggregator: 'Sum',
            },
            userId: 42,
          });

          expect(result).toBe(false);

          expect(getUserInfoMock).toHaveBeenCalledWith(42);
          expect(getUserInfoMock).toHaveBeenCalledTimes(2);
          expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(60, options);
          expect(serverInterface.getRenderingPermissions).toHaveBeenCalledTimes(2);

          expect(hashChartRequestMock).toHaveBeenCalledWith({
            type: ChartType.Value,
            sourceCollectionName: 'jedi',
            aggregateFieldName: 'strength',
            aggregator: 'Sum',
          });

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
        serverInterface,
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
      serverInterface.getRenderingPermissions = jest.fn().mockResolvedValue({
        collections: {},
        stats,
        team: {},
      });
      hashServerChartsMock.mockReturnValue(new Set(['HASH']));
      hashChartRequestMock.mockReturnValue('HASH');

      const result1 = await renderingPermission.canExecuteChart({
        renderingId: 60,
        chartRequest: {
          type: ChartType.Value,
          sourceCollectionName: 'jedi',
          aggregateFieldName: 'strength',
          aggregator: 'Sum',
        },
        userId: 42,
      });

      renderingPermission.invalidateCache(60);

      const result2 = await renderingPermission.canExecuteChart({
        renderingId: 60,
        chartRequest: {
          type: ChartType.Value,
          sourceCollectionName: 'jedi',
          aggregateFieldName: 'strength',
          aggregator: 'Sum',
        },
        userId: 42,
      });
      expect(result1).toBe(true);
      expect(result2).toBe(true);

      expect(serverInterface.getRenderingPermissions).toHaveBeenCalledTimes(2);
    });

    it('should not invalidate the cache of other renderings', async () => {
      const {
        renderingPermission,
        getUserInfoMock,
        serverInterface,
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
      serverInterface.getRenderingPermissions = jest.fn().mockResolvedValue({
        collections: {},
        stats,
        team: {},
      });
      hashServerChartsMock.mockReturnValue(new Set(['HASH']));
      hashChartRequestMock.mockReturnValue('HASH');

      const result1 = await renderingPermission.canExecuteChart({
        renderingId: 60,
        chartRequest: {
          type: ChartType.Value,
          sourceCollectionName: 'jedi',
          aggregateFieldName: 'strength',
          aggregator: 'Sum',
        },
        userId: 42,
      });

      renderingPermission.invalidateCache(666);

      const result2 = await renderingPermission.canExecuteChart({
        renderingId: 60,
        chartRequest: {
          type: ChartType.Value,
          sourceCollectionName: 'jedi',
          aggregateFieldName: 'strength',
          aggregator: 'Sum',
        },
        userId: 42,
      });
      expect(result1).toBe(true);
      expect(result2).toBe(true);

      expect(serverInterface.getRenderingPermissions).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidateAllCache', () => {
    it('should invalidate the cache for all renderings', async () => {
      const {
        renderingPermission,
        getUserInfoMock,
        serverInterface,
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
      serverInterface.getRenderingPermissions = jest.fn().mockResolvedValue({
        collections: {},
        stats,
        team: {},
      });
      hashServerChartsMock.mockReturnValue(new Set(['HASH']));
      hashChartRequestMock.mockReturnValue('HASH');

      const resultA1 = await renderingPermission.canExecuteChart({
        renderingId: 60,
        chartRequest: {
          type: ChartType.Value,
          sourceCollectionName: 'jedi',
          aggregateFieldName: 'strength',
          aggregator: 'Sum',
        },
        userId: 42,
      });

      const resultB1 = await renderingPermission.canExecuteChart({
        renderingId: 63,
        chartRequest: {
          type: ChartType.Value,
          sourceCollectionName: 'jedi',
          aggregateFieldName: 'strength',
          aggregator: 'Sum',
        },
        userId: 42,
      });

      renderingPermission.invalidateAllCache();

      const resultA2 = await renderingPermission.canExecuteChart({
        renderingId: 60,
        chartRequest: {
          type: ChartType.Value,
          sourceCollectionName: 'jedi',
          aggregateFieldName: 'strength',
          aggregator: 'Sum',
        },
        userId: 42,
      });

      const resultB2 = await renderingPermission.canExecuteChart({
        renderingId: 63,
        chartRequest: {
          type: ChartType.Value,
          sourceCollectionName: 'jedi',
          aggregateFieldName: 'strength',
          aggregator: 'Sum',
        },
        userId: 42,
      });

      expect(resultA1).toBe(true);
      expect(resultA2).toBe(true);
      expect(resultB1).toBe(true);
      expect(resultB2).toBe(true);

      expect(serverInterface.getRenderingPermissions).toHaveBeenCalledTimes(4);
    });
  });

  describe('canExecuteSegmentQuery', () => {
    it('should return true if the segment query is allowed', async () => {
      const {
        renderingPermission,
        serverInterface,
        verifySQLQueryMock,
        isSegmentQueryAllowedMock,
        options,
      } = setup();

      const actorsPermissions = {
        segments: [{ query: 'foo' }],
        scopes: [],
      };

      const permissions = {
        team: { id: 33 },
        collections: {
          actors: actorsPermissions,
        },
        stats: {},
      };

      serverInterface.getRenderingPermissions = jest.fn().mockResolvedValue(permissions);
      verifySQLQueryMock.mockReturnValue(true);
      isSegmentQueryAllowedMock.mockReturnValue(true);

      const result = await renderingPermission.canExecuteSegmentQuery({
        renderingId: 42,
        collectionName: 'actors',
        segmentQuery: 'SELECT * from actors',
      });

      expect(result).toBe(true);

      expect(isSegmentQueryAllowedMock).toHaveBeenCalledWith(
        'SELECT * from actors',
        actorsPermissions.segments,
      );
      expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(42, options);
    });

    it('should return false if the collection does not have an entry in permissions', async () => {
      const { renderingPermission, serverInterface, isSegmentQueryAllowedMock, options } = setup();

      const permissions = {
        team: { id: 33 },
        collections: {},
        stats: {},
      };

      serverInterface.getRenderingPermissions = jest.fn().mockResolvedValue(permissions);

      const result = await renderingPermission.canExecuteSegmentQuery({
        renderingId: 42,
        collectionName: 'actors',
        segmentQuery: 'SELECT * from actors',
      });

      expect(result).toBe(false);

      expect(isSegmentQueryAllowedMock).not.toHaveBeenCalled();
      expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(42, options);
    });

    it('should return false if the query is not allowed', async () => {
      const {
        renderingPermission,
        serverInterface,
        verifySQLQueryMock,
        isSegmentQueryAllowedMock,
        options,
      } = setup();

      const actorsPermissions = {
        segments: [{ query: 'foo' }],
        scopes: [],
      };

      const permissions = {
        team: { id: 33 },
        collections: {
          actors: actorsPermissions,
        },
        stats: {},
      };

      serverInterface.getRenderingPermissions = jest.fn().mockResolvedValue(permissions);
      verifySQLQueryMock.mockReturnValue(true);
      isSegmentQueryAllowedMock.mockReturnValue(false);

      const result = await renderingPermission.canExecuteSegmentQuery({
        renderingId: 42,
        collectionName: 'actors',
        segmentQuery: 'SELECT * from actors',
      });

      expect(result).toBe(false);

      expect(isSegmentQueryAllowedMock).toHaveBeenCalledWith(
        'SELECT * from actors',
        actorsPermissions.segments,
      );
      expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(42, options);
    });

    it('should refresh the cache if the query is not allowed', async () => {
      const {
        renderingPermission,
        serverInterface,
        isSegmentQueryAllowedMock,
        verifySQLQueryMock,
        options,
      } = setup();

      const actorsPermissions1 = {
        segments: [{ query: 'foo' }],
        scopes: [],
      };

      const permissions1 = {
        team: { id: 33 },
        collections: {
          actors: actorsPermissions1,
        },
        stats: {},
      };

      const actorsPermissions2 = {
        segments: [{ query: 'bar' }],
        scopes: [],
      };

      const permissions2 = {
        team: { id: 33 },
        collections: {
          actors: actorsPermissions2,
        },
        stats: {},
      };

      serverInterface.getRenderingPermissions = jest
        .fn()
        .mockResolvedValueOnce(permissions1)
        .mockResolvedValueOnce(permissions2);
      isSegmentQueryAllowedMock.mockReturnValueOnce(false).mockReturnValueOnce(true);
      verifySQLQueryMock.mockReturnValue(true);

      const result = await renderingPermission.canExecuteSegmentQuery({
        renderingId: 42,
        collectionName: 'actors',
        segmentQuery: 'SELECT * from actors',
      });

      expect(result).toBe(true);

      expect(isSegmentQueryAllowedMock).toHaveBeenCalledTimes(2);
      expect(isSegmentQueryAllowedMock).toHaveBeenCalledWith(
        'SELECT * from actors',
        actorsPermissions2.segments,
      );
      expect(serverInterface.getRenderingPermissions).toHaveBeenCalledTimes(2);
      expect(serverInterface.getRenderingPermissions).toHaveBeenCalledWith(42, options);
    });
  });
});
