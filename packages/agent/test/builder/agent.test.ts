import * as factories from '../agent/__factories__';
import Agent from '../../src/builder/agent';
import CollectionBuilder from '../../src/builder/collection';

const instance = {
  start: jest.fn(),
};
jest.mock('../../src/agent/forestadmin-http-driver', () => {
  return {
    default: { ForestAdminHttpDriver: () => instance },
  };
});

describe('Builder > Agent', () => {
  it('should build an agent', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    expect(agent.httpCallback).toBeDefined();
  });

  it('should start forestAdminHttpDriver', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    await agent.start();

    expect(instance.start).toHaveBeenCalled();
  });

  it('should stop forestAdminHttpDriver', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    await expect(() => agent.start()).rejects.toThrow();

    await expect(() => agent.stop()).resolves.not.toThrow();
  });

  it('should add collection datasource to the composite one', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({ name: 'targetedCollection' }),
    );

    await agent.addDatasource(async () => dataSource).start();

    expect(() => agent.customizeCollection('targetedCollection', jest.fn())).not.toThrow();
  });

  describe('collection', () => {
    describe('when designed collection is unknown', () => {
      it('should throw an error', async () => {
        const options = factories.forestAdminHttpDriverOptions.build();
        const agent = new Agent(options);

        await expect(agent.customizeCollection('unknown', () => {}).start()).rejects.toThrowError(
          'Collection "unknown" not found',
        );
      });
    });

    it('should provide collection builder', async () => {
      const options = factories.forestAdminHttpDriverOptions.build();
      const agent = new Agent(options);
      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );

      const spy = jest.fn();

      await agent
        .addDatasource(async () => dataSource)
        .customizeCollection('collection', spy)
        .start();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(new CollectionBuilder('collection'));
    });
  });
});
