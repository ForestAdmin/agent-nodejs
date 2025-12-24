import type { Context } from 'koa';

import { UnprocessableError } from '@forestadmin/datasource-toolkit';
import { ChartType } from '@forestadmin/forestadmin-client';

import makeRoutes from '../../../src/routes';
import DataSourceNativeQueryRoute from '../../../src/routes/access/native-query-datasource';
import * as factories from '../../__factories__';

describe('DataSourceNativeQueryRoute', () => {
  describe('setupRoutes', () => {
    afterEach(() => jest.resetAllMocks());

    const setupWithLiveQuery = () => {
      return factories.dataSource.build({
        nativeQueryConnections: { main: {} },
        schema: { charts: ['myChart'] },
        collections: [
          factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              charts: ['myChart'],
            }),
          }),
        ],
      });
    };

    const router = factories.router.build();
    router.post = jest.fn();

    const dataSource = setupWithLiveQuery();
    const routes = makeRoutes(
      dataSource,
      factories.forestAdminHttpDriverOptions.build(),
      factories.forestAdminHttpDriverServices.build(),
    );
    const liveQueryRoute = routes.find(
      route => route instanceof DataSourceNativeQueryRoute,
    ) as DataSourceNativeQueryRoute;

    test('calling the setup', () => {
      liveQueryRoute.setupRoutes(router);

      expect(router.post).toHaveBeenCalledOnce();
      expect(router.post).toHaveBeenCalledWith('/_internal/native_query', expect.toBeFunction());
    });

    describe('call handling', () => {
      test.each([
        { type: ChartType.Leaderboard, result: { value: 111, key: 'machines' } },
        { type: ChartType.Pie, result: { value: 111, key: 'machines' } },
        { type: ChartType.Value, result: { value: 111 } },
        { type: ChartType.Line, result: { value: 111, key: 'machines' } },
        { type: ChartType.Objective, result: { value: 111, objective: 500 } },
      ])('it should execute the native query', async ({ type, result }) => {
        liveQueryRoute.setupRoutes(router);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        liveQueryRoute.services.chartHandler.getQueryForChart = jest.fn().mockResolvedValue({
          query: 'Select * FROM toto',
          contextVariables: {},
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        liveQueryRoute.dataSource.executeNativeQuery = jest.fn().mockResolvedValue([result]);

        expect(router.post).toHaveBeenCalledOnce();
        expect(router.post).toHaveBeenCalledWith('/_internal/native_query', expect.toBeFunction());
        const handleNativeQuery = (router.post as jest.Mock).mock.calls[0][1] as (
          context: Context,
        ) => Promise<void>;

        const context = {
          state: {
            user: {
              renderingId: 101,
              userId: 1,
            },
          },
          response: {},
          request: {
            body: {
              query: 'Select * FROM toto',
              connectionName: 'main',
              type,
            },
          },
        } as Context;

        await handleNativeQuery(context);

        expect(context.response.body).toEqual({
          data: {
            id: expect.toBeString(),
            type: 'stats',
            attributes: { value: expect.toSatisfy(e => Array.isArray(e) || typeof e === 'object') },
          },
        });
      });

      describe('error cases', () => {
        describe('when the query is not a chart request', () => {
          test('it should throw a specific error', async () => {
            liveQueryRoute.setupRoutes(router);

            expect(router.post).toHaveBeenCalledOnce();
            expect(router.post).toHaveBeenCalledWith(
              '/_internal/native_query',
              expect.toBeFunction(),
            );
            const handleNativeQuery = (router.post as jest.Mock).mock.calls[0][1] as (
              context: Context,
            ) => Promise<void>;

            await expect(() =>
              handleNativeQuery({ request: { body: {} } } as Context),
            ).rejects.toThrow(
              new UnprocessableError('Native query endpoint only supports Query Chart Requests'),
            );
          });
        });

        describe('when connectionName is unknown', () => {
          test('it should throw an error', async () => {
            liveQueryRoute.setupRoutes(router);

            expect(router.post).toHaveBeenCalledOnce();
            expect(router.post).toHaveBeenCalledWith(
              '/_internal/native_query',
              expect.toBeFunction(),
            );
            const handleNativeQuery = (router.post as jest.Mock).mock.calls[0][1] as (
              context: Context,
            ) => Promise<void>;

            await expect(() =>
              handleNativeQuery({
                request: {
                  body: {
                    query: 'Select * FROM toto',
                    connectionName: 'Something',
                    type: ChartType.Pie,
                  },
                },
              } as Context),
            ).rejects.toThrow(
              new UnprocessableError(`Native query connection 'Something' is unknown`),
            );
          });
        });

        describe('when connectionName is missing', () => {
          test('it should throw an error', async () => {
            liveQueryRoute.setupRoutes(router);

            expect(router.post).toHaveBeenCalledOnce();
            expect(router.post).toHaveBeenCalledWith(
              '/_internal/native_query',
              expect.toBeFunction(),
            );
            const handleNativeQuery = (router.post as jest.Mock).mock.calls[0][1] as (
              context: Context,
            ) => Promise<void>;

            await expect(() =>
              handleNativeQuery({
                request: {
                  body: {
                    query: 'Select * FROM toto',
                    type: ChartType.Pie,
                  },
                },
              } as Context),
            ).rejects.toThrow(new UnprocessableError(`Missing native query connection attribute`));
          });
        });

        describe('when sql query causes an error', () => {
          test('it should throw an error', async () => {
            liveQueryRoute.setupRoutes(router);

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            liveQueryRoute.services.chartHandler.getQueryForChart = jest.fn().mockResolvedValue({
              query: 'Select * FROM toto',
              contextVariables: {},
            });
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            liveQueryRoute.dataSource.executeNativeQuery = jest
              .fn()
              .mockRejectedValue(new Error('Something bad happened'));

            expect(router.post).toHaveBeenCalledOnce();
            expect(router.post).toHaveBeenCalledWith(
              '/_internal/native_query',
              expect.toBeFunction(),
            );
            const handleNativeQuery = (router.post as jest.Mock).mock.calls[0][1] as (
              context: Context,
            ) => Promise<void>;

            const context = {
              state: {
                user: {
                  renderingId: 101,
                  userId: 1,
                },
              },
              response: {},
              request: {
                body: {
                  query: 'Select * FROM toto',
                  connectionName: 'main',
                  type: ChartType.Pie,
                },
              },
            } as Context;

            await expect(handleNativeQuery(context)).rejects.toThrow(
              new UnprocessableError(
                'Error during chart native query execution: Something bad happened',
              ),
            );
          });
        });

        describe('when query returns wrong keys', () => {
          test.each([
            { type: ChartType.Leaderboard },
            { type: ChartType.Pie },
            { type: ChartType.Value },
            { type: ChartType.Line },
            { type: ChartType.Objective },
          ])('it should throw an error', async ({ type }) => {
            liveQueryRoute.setupRoutes(router);

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            liveQueryRoute.services.chartHandler.getQueryForChart = jest.fn().mockResolvedValue({
              query: 'Select * FROM toto',
              contextVariables: {},
            });
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            liveQueryRoute.dataSource.executeNativeQuery = jest.fn().mockResolvedValue([{ id: 1 }]);

            expect(router.post).toHaveBeenCalledOnce();
            expect(router.post).toHaveBeenCalledWith(
              '/_internal/native_query',
              expect.toBeFunction(),
            );
            const handleNativeQuery = (router.post as jest.Mock).mock.calls[0][1] as (
              context: Context,
            ) => Promise<void>;

            const context = {
              state: {
                user: {
                  renderingId: 101,
                  userId: 1,
                },
              },
              response: {},
              request: {
                body: {
                  query: 'Select * FROM toto',
                  connectionName: 'main',
                  type,
                },
              },
            } as Context;

            await expect(handleNativeQuery(context)).rejects.toThrow(UnprocessableError);
          });
        });
      });
    });
  });
});
