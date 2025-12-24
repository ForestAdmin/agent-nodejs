import type { CollectionCustomizerFunction, TestableSearchReplacement } from './types';

// eslint-disable-next-line import/prefer-default-export
export function getSearchReplacement(
  collectionCustomizerFunction: CollectionCustomizerFunction,
  ...args: any[]
): TestableSearchReplacement {
  let searchReplacement: TestableSearchReplacement;

  const collection = {
    replaceSearch(definition) {
      if (searchReplacement) throw new Error('You have two replacements in your customization');
      searchReplacement = definition;

      return this;
    },
  };

  collectionCustomizerFunction(collection as any, ...args);

  return searchReplacement;
}
