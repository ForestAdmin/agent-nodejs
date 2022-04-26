import * as factories from '../agent/__factories__';
import Agent from '../../src/builder/agent';
import CollectionBuilder from '../../src/builder/collection';

let forestAdminHttpDriverInstance;

jest.mock('../../src/agent/forestadmin-http-driver', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(options => {
      forestAdminHttpDriverInstance = {
        start: jest.fn(),
        handler: jest.fn(),
        stop: jest.fn(),
        options,
      };

      return forestAdminHttpDriverInstance;
    }),
  };
});

describe('Builder > Agent', () => {
  it('should build an agent, provide a httpCallback and init the collection builder', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const initCollectionBuilder = jest.spyOn(CollectionBuilder, 'init');
    const agent = new Agent(options);

    expect(agent.httpCallback).toBeDefined();
    expect(initCollectionBuilder).toHaveBeenCalled();
  });

  it('should start forestAdminHttpDriver', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    await agent.start();

    expect(forestAdminHttpDriverInstance.start).toHaveBeenCalled();
  });

  it('should stop forestAdminHttpDriver', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    await agent.stop();

    expect(forestAdminHttpDriverInstance.stop).toHaveBeenCalled();
  });

  describe('customizeCollection', () => {
    describe('when designed collection is unknown', () => {
      it('should throw an error', async () => {
        const options = factories.forestAdminHttpDriverOptions.build();
        const agent = new Agent(options);

        await expect(agent.customizeCollection('unknown', () => {}).start()).rejects.toThrowError(
          'Collection "unknown" not found',
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
        .addDatasource(async () => dataSource)
        .customizeCollection('collection', handle)
        .start();

      expect(handle).toHaveBeenCalledTimes(1);
      expect(handle).toHaveBeenCalledWith(new CollectionBuilder('collection'));
    });
  });
});
