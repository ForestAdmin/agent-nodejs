import { UnprocessableError } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import makeRoutes from '../../../src/routes';
import DataSourceNativeQueryRoute from '../../../src/routes/access/native-query-datasource';
import * as factories from '../../__factories__';

describe('DataSourceNativeQueryRoute', () => {
  describe('setupRoutes', () => {
    afterEach(() => jest.resetAllMocks());

    const setupWithLiveQuery = () => {
      return factories.dataSource.build({
        nativeQueryConnections: { name: 'Postgre' },
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
      describe('error cases', () => {
        describe('if the query is not a chart request', () => {
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
      });
    });
  });
});
