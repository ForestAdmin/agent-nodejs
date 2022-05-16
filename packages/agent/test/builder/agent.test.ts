import * as factories from '../agent/__factories__';
import Agent from '../../src/builder/agent';
import CollectionBuilder from '../../src/builder/collection';
import DecoratorsStack from '../../src/builder/decorators-stack';

const mockStart = jest.fn();
const mockHandler = jest.fn();
const mockStop = jest.fn();
const mockWriteFile = jest.fn().mockResolvedValue(null);

jest.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

jest.mock('../../src/agent/forestadmin-http-driver', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((dataSource, options) => ({
    start: mockStart,
    handler: mockHandler,
    stop: mockStop,
    options,
  })),
}));

describe('Builder > Agent', () => {
  it('should build an agent, provide a httpCallback and init the collection builder', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    expect(agent.httpCallback).toBeDefined();
  });

  it('should start forestAdminHttpDriver and not generate types', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    await agent.start();

    expect(mockStart).toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should generate types on start and generate types', async () => {
    const options = factories.forestAdminHttpDriverOptions.build({
      isProduction: false,
      typingsPath: 'typings.d.ts',
      typingsMaxDepth: 5,
    });

    const agent = new Agent(options);
    await agent.start();

    expect(mockStart).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('should stop forestAdminHttpDriver', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    await agent.stop();

    expect(mockStop).toHaveBeenCalled();
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
    describe('when designed collection is unknown', () => {
      it('should throw an error', async () => {
        const options = factories.forestAdminHttpDriverOptions.build();
        const agent = new Agent(options);

        await expect(agent.customizeCollection('unknown', () => {}).start()).rejects.toThrowError(
          "Collection 'unknown' not found",
        );
      });
    });

    it('should provide collection builder when the agent is started', async () => {
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
