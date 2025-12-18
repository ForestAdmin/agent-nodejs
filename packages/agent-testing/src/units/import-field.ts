import type { CollectionCustomizerFunction, TestableImportedField } from './types';

// eslint-disable-next-line import/prefer-default-export
export function getImportedField(
  collectionCustomizerFunction: CollectionCustomizerFunction,
  ...args: any[]
): TestableImportedField {
  let field: TestableImportedField;

  const collection = {
    importField(name, options) {
      if (field) throw new Error('You have two importField in your customization');
      field = { options, name };

      return this;
    },
  };

  collectionCustomizerFunction(collection as any, ...args);

  return field;
}
