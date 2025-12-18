import type { CollectionCustomizerFunction, TestableAddedManyToOneRelation } from './types';

// eslint-disable-next-line import/prefer-default-export
export function getAddedManyToOneRelation(
  collectionCustomizerFunction: CollectionCustomizerFunction,
  ...args: any[]
): TestableAddedManyToOneRelation {
  let relation: TestableAddedManyToOneRelation;

  const collection = {
    addManyToOneRelation(name, foreignCollection, options) {
      if (relation) throw new Error('You have two addManyToOneRelation in your customization');
      relation = { name, foreignCollection, options };

      return this;
    },
  };

  collectionCustomizerFunction(collection as any, ...args);

  return relation;
}
