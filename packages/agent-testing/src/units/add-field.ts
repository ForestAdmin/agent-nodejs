import type { CollectionCustomizerFunction, TestableField } from './types';

// eslint-disable-next-line import/prefer-default-export
export function getAddedField(
  collectionCustomizerFunction: CollectionCustomizerFunction,
  ...args: any[]
): TestableField {
  let field: TestableField;

  const collection = {
    addField(name, definition) {
      if (field) throw new Error('You have two addField in your customization');
      field = { definition, name };

      return this;
    },
  };

  collectionCustomizerFunction(collection as any, ...args);

  return field;
}
