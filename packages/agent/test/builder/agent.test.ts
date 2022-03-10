import * as factories from '../agent/__factories__';
import Agent from '../../src/builder/agent';
import CollectionBuilder from '../../src/builder/collection';

jest.mock('../../src/agent/forestadmin-http-driver');

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

    const spy = jest.spyOn(agent.forestAdminHttpDriver, 'start');

    await agent.start();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should stop forestAdminHttpDriver', async () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    const spy = jest.spyOn(agent.forestAdminHttpDriver, 'stop');

    await agent.stop();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should add collection datasource to the composite one', () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    expect(agent.compositeDatasource.collections.length).toBe(0);

    const dataSource = factories.dataSource.buildWithCollection(factories.collection.build());

    const chainingAgent = agent.addDatasource(dataSource);

    expect(agent.compositeDatasource.collections.length).toBe(1);
    expect(chainingAgent).toBe(agent);
  });

  describe('collection', () => {
    describe('when designed collection is unknow', () => {
      it('should throw an error', () => {
        const options = factories.forestAdminHttpDriverOptions.build();
        const agent = new Agent(options);

        expect(() => agent.collection('unknow', () => {})).toThrowError(
          'Collection "unknow" not found',
        );
      });
    });

    it('should provide collection builder', () => {
      const options = factories.forestAdminHttpDriverOptions.build();
      const agent = new Agent(options);
      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );

      const spy = jest.fn();

      agent.addDatasource(dataSource).collection('collection', spy);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(new CollectionBuilder(agent, 'collection'));
    });
  });
});
