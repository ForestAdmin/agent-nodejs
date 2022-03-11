import * as factories from '../agent/__factories__';
import Agent from '../../src/builder/agent';
import CollectionBuilder from '../../src/builder/collection';

describe('Builder > Agent', () => {
  const setup = () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    const collectionName = '__collection__';
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: collectionName,
        schema: factories.collectionSchema.build({
          fields: {
            firstName: factories.columnSchema.build(),
          },
        }),
      }),
    );

    agent.addDatasource(dataSource);

    const collectionBuilder = new CollectionBuilder(agent, collectionName);

    return { agent, collectionBuilder, collectionName };
  };

  describe('renameField', () => {
    it('should rename a field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.rename.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'renameField');

      collectionBuilder.renameField('firstName', 'renamed');

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', 'renamed');
      expect(collection.schema.fields.renamed).toBeDefined();
    });
  });

  describe('publishFields', () => {
    it('should publish a field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.publication.getCollection(collectionName);

      collectionBuilder.unpublishFields(['firstName']);
      expect(collection.schema.fields.firstName).toBeUndefined();

      const spy = jest.spyOn(collection, 'changeFieldVisibility');

      collectionBuilder.publishFields(['firstName']);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', true);
      expect(collection.schema.fields.firstName).toBeDefined();
    });
  });

  describe('unpublishFields', () => {
    it('should unpublish a field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.publication.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'changeFieldVisibility');

      collectionBuilder.unpublishFields(['firstName']);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', false);
      expect(collection.schema.fields.firstName).toBeUndefined();
    });
  });

  // describe('registerAction', () => {
  //   it('should do something', () => {
  //     const { agent, collectionBuilder } = setup();

  //     collectionBuilder.registerAction();
  //   });
  // });

  // describe('registerField', () => {
  //   it('should do something', () => {
  //     const { agent, collectionBuilder } = setup();

  //     collectionBuilder.registerField();
  //   });
  // });

  // describe('emulateSort', () => {
  //   it('should do something', () => {
  //     const { agent, collectionBuilder } = setup();

  //     collectionBuilder.emulateSort();
  //   });
  // });

  // describe('implementSort', () => {
  //   it('should do something', () => {
  //     const { agent, collectionBuilder } = setup();

  //     collectionBuilder.implementSort();
  //   });
  // });

  // describe('emulateOperator', () => {
  //   it('should do something', () => {
  //     const { agent, collectionBuilder } = setup();

  //     collectionBuilder.emulateOperator();
  //   });
  // });

  // describe('implementOperator', () => {
  //   it('should do something', () => {
  //     const { agent, collectionBuilder } = setup();

  //     collectionBuilder.implementOperator();
  //   });
  // });
});
