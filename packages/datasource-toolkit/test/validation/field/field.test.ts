import FieldValidator from '../../../src/validation/field';

describe('FieldValidator', () => {
  test('should fail with name conataining space', () => {
    expect(() => FieldValidator.validateName('collectionName', 'field name')).toThrow(
      `The name of field 'field name' you configured on 'collectionName' must not contain space.` +
        ` Something like 'fieldName' should work has expected.`,
    );
  });

  test('should not fail with a valid name', () => {
    expect(() => FieldValidator.validateName('collectionName', 'fieldName')).not.toThrow();
  });
});
