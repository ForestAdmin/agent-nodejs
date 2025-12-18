import type { CollectionCustomizerFunction, TestableHook } from './types';

// eslint-disable-next-line import/prefer-default-export
export function getAddedHook(
  collectionCustomizerFunction: CollectionCustomizerFunction,
  ...args: any[]
): TestableHook {
  let hook: TestableHook;

  const collection = {
    addHook(position, type, handler) {
      if (hook) throw new Error('You have two addHook in your customization');
      hook = { position, type, handler };

      return this;
    },
  };

  collectionCustomizerFunction(collection as any, ...args);

  return hook;
}
