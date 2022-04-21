import * as factories from '../agent/__factories__';
import Agent from '../../src/builder/agent';
import CollectionBuilder from '../../src/builder/collection';

describe('Builder > Agent', () => {
  it('should build an agent', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    const forestAdminHttpDriverCallback = Symbol('callback');
    Object.defineProperty(agent.forestAdminHttpDriver, 'handler', {
      get: () => forestAdminHttpDriverCallback,
    });

    expect(agent.httpCallback).toBe(forestAdminHttpDriverCallback);
  });

  it('should start forestAdminHttpDriver', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    const spy = jest.spyOn(agent.forestAdminHttpDriver, 'start').mockResolvedValue();

    await agent.start();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should stop forestAdminHttpDriver', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    const spy = jest.spyOn(agent.forestAdminHttpDriver, 'stop').mockResolvedValue();

    await agent.stop();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should add collection datasource to the composite one', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);
    jest.spyOn(agent.forestAdminHttpDriver, 'start').mockResolvedValue();

    expect(agent.compositeDatasource.collections.length).toBe(0);

    const dataSource = factories.dataSource.buildWithCollection(factories.collection.build());

    await agent.addDatasource(async () => dataSource).start();

    expect(agent.compositeDatasource.collections.length).toBe(1);
  });

  describe('collection', () => {
    describe('when designed collection is unknown', () => {
      it('should throw an error', async () => {
        const options = factories.forestAdminHttpDriverOptions.build();
        const agent = new Agent(options);
        jest.spyOn(agent.forestAdminHttpDriver, 'start').mockResolvedValue();

        await expect(agent.customizeCollection('unknown', () => {}).start()).rejects.toThrowError(
          'Collection "unknown" not found',
        );
      });
    });

    it('should provide collection builder', async () => {
      const options = factories.forestAdminHttpDriverOptions.build();
      const agent = new Agent(options);
      jest.spyOn(agent.forestAdminHttpDriver, 'start').mockResolvedValue();
      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );

      const spy = jest.fn();

      await agent
        .addDatasource(async () => dataSource)
        .customizeCollection('collection', spy)
        .start();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(new CollectionBuilder(agent, 'collection'));
    });
  });
});
