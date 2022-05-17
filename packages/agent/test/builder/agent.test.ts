import Router from '@koa/router';
import superagent from 'superagent';

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
  describe('Methods', () => {
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
  });

  describe('Framework drivers', () => {
    describe('Standalone', () => {
      it('should be able to bind a port an clear it', async () => {
        expect.assertions(1);

        const options = factories.forestAdminHttpDriverOptions.build();
        const agent = new Agent(options);

        try {
          await agent.mountStandalone(9998, 'localhost').start();

          const response = await superagent.get('http://localhost:9998/forest');
          expect(response.text).toStrictEqual('all good');
        } finally {
          await agent.stop();
        }
      });
    });
  });
});
