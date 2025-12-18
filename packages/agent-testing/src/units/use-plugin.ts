import type { CollectionCustomizerFunction, TestableUsedPlugin } from './types';

// eslint-disable-next-line import/prefer-default-export
export function getUsedPlugin(
  collectionCustomizerFunction: CollectionCustomizerFunction,
  ...args: any[]
): TestableUsedPlugin {
  let used: TestableUsedPlugin;

  const collection = {
    use(_, options) {
      if (!options) throw new Error('You have no options for this plugin');
      used = { options };

      return this;
    },
  };

  collectionCustomizerFunction(collection as any, ...args);

  return used;
}
