import { PaginatedFilter } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import SegmentQueryHandler from '../../src/services/segment-query-handler';

describe('SegmentQueryHandler', () => {
  const spyBuildContextVariables = jest.fn().mockResolvedValue({});

  const setupService = (): SegmentQueryHandler => {
    return new SegmentQueryHandler({ buildContextVariables: spyBuildContextVariables });
  };

  afterEach(() => jest.resetAllMocks());

  describe('when no liveQuerySegment is defined', () => {
    test('should do nothing', async () => {
      const context = {
        state: { user: {} },
      } as Context;
      const paginatedFilter = new PaginatedFilter({});

      const service = setupService();

      const result = await service.handleLiveQuerySegmentFilter(context, paginatedFilter);
      expect(spyBuildContextVariables).not.toHaveBeenCalled();
      expect(result).toStrictEqual(paginatedFilter);
    });
  });

  describe('when liveQuerySegment is defined', () => {
    test('should handle the live query', async () => {
      const context = {
        state: { user: { id: 42, renderingId: 101 } },
      } as Context;
      const paginatedFilter = new PaginatedFilter({
        liveQuerySegment: {
          query: 'SELECT id FROM "users" WHERE email like {{currentUser.email}};',
          connectionName: 'main',
        },
      });

      spyBuildContextVariables.mockResolvedValue({ getValue: () => 'johndoe@forestadmin.com' });
      const service = setupService();

      const result = await service.handleLiveQuerySegmentFilter(context, paginatedFilter);
      expect(spyBuildContextVariables).toHaveBeenCalled();
      expect(result).toStrictEqual(
        paginatedFilter.override({
          liveQuerySegment: {
            query: 'SELECT id FROM "users" WHERE email like $currentUser_email;',
            contextVariables: { currentUser_email: 'johndoe@forestadmin.com' },
            connectionName: 'main',
          },
        }),
      );
    });
  });
});
