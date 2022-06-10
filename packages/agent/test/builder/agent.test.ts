import Router from '@koa/router';

import * as factories from '../agent/__factories__';
import Agent from '../../src/builder/agent';
import CollectionBuilder from '../../src/builder/collection';
import DecoratorsStack from '../../src/builder/decorators-stack';

const mockWriteFile = jest.fn().mockResolvedValue(null);
const mockSendSchema = jest.fn();
const mockGetRouter = jest.fn(() =>
  new Router().get('/', ctx => {
    ctx.response.body = 'all good';
  }),
);

jest.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

jest.mock('../../src/agent/forestadmin-http-driver', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((dataSource, options) => ({
    sendSchema: mockSendSchema,
    getRouter: mockGetRouter,
    dataSource,
    options,
  })),
}));

describe('Builder > Agent', () => {
  describe('start', () => {
    it('should start forestAdminHttpDriver and not generate types', async () => {
      const options = factories.forestAdminHttpDriverOptions.build();
      const agent = new Agent(options);

      await agent.start();

      expect(mockGetRouter).toHaveBeenCalled();
      expect(mockSendSchema).toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should generate types on start', async () => {
      const options = factories.forestAdminHttpDriverOptions.build({
        isProduction: false,
        typingsPath: 'typings.d.ts',
        typingsMaxDepth: 5,
      });

      const agent = new Agent(options);
      const result = await agent.start();

      expect(result).toBe(undefined);
      expect(mockGetRouter).toHaveBeenCalled();
      expect(mockSendSchema).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  describe('addChart', () => {
    it('should add the chart to the schema', async () => {
      const options = factories.forestAdminHttpDriverOptions.build();
      const agent = new Agent(options);

      await agent
        .addChart('myChart', (context, resultBuilder) => resultBuilder.value(12332, 3224))
        .start();

      // Access private variable
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const { dataSource } = agent.stack;

      // Check that the chart was added to the datasource
      expect(dataSource.schema.charts).toContain('myChart');
      await expect(dataSource.renderChart(null, 'myChart')).resolves.toStrictEqual({
        countCurrent: 12332,
        countPrevious: 3224,
      });
    });
  });

  describe('customizeCollection', () => {
    it('should throw an error when designed collection is unknown', async () => {
      const options = factories.forestAdminHttpDriverOptions.build();
      const agent = new Agent(options);

      await expect(agent.customizeCollection('unknown', () => {}).start()).rejects.toThrowError(
        "Collection 'unknown' not found",
      );
    });

    it('should provide collection builder otherwise', async () => {
      const options = factories.forestAdminHttpDriverOptions.build();
      const agent = new Agent(options);

      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );

      const handle = jest.fn();

      await agent
        .addDataSource(async () => dataSource)
        .customizeCollection('collection', handle)
        .start();

      expect(handle).toHaveBeenCalledTimes(1);
      expect(handle).toHaveBeenCalledWith(
        new CollectionBuilder(expect.any(DecoratorsStack), 'collection'),
      );
    });
  });

  describe('rename option', () => {
    describe('when there is a naming conflict with two collection names', () => {
      it('should throw an error when the given collection name does not exist', async () => {
        const options = factories.forestAdminHttpDriverOptions.build();
        const agent = new Agent(options);

        const dataSource1 = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        const dataSource2 = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        agent.addDataSource(async () => dataSource1);
        agent.addDataSource(async () => dataSource2, {
          rename: {
            collectionDoesNotExist: 'updatedName',
          },
        });

        await expect(agent.start()).rejects.toThrowError(
          'The given collection name "collectionDoesNotExist" does not exist',
        );
      });

      it('should throw an error when the new name is also in conflict', async () => {
        const options = factories.forestAdminHttpDriverOptions.build();
        const agent = new Agent(options);

        const dataSource1 = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        const dataSource2 = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        agent.addDataSource(async () => dataSource1);
        agent.addDataSource(async () => dataSource2, {
          rename: {
            collection: 'collection',
          },
        });

        await expect(agent.start()).rejects.toThrowError(
          "Collection 'collection' already defined in datasource",
        );
      });

      it('should rename the collection name without error', async () => {
        const options = factories.forestAdminHttpDriverOptions.build();
        const agent = new Agent(options);

        const dataSource1 = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        const dataSource2 = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        agent.addDataSource(async () => dataSource1);
        agent.addDataSource(async () => dataSource2, {
          rename: {
            collection: 'updatedName',
          },
        });

        await expect(agent.start()).resolves.not.toThrowError();
      });

      it('should not throw an error when rename option is null', async () => {
        const options = factories.forestAdminHttpDriverOptions.build();
        const agent = new Agent(options);

        const dataSource = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        agent.addDataSource(async () => dataSource, {
          rename: null,
        });

        await expect(agent.start()).resolves.not.toThrowError();
      });
    });
  });
});
