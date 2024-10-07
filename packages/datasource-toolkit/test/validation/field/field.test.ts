import { MissingFieldError } from '../../../src';
import FieldValidator from '../../../src/validation/field';
import * as factories from '../../__factories__';

describe('FieldValidator', () => {
  test('should fail with name containing space', () => {
    expect(() => FieldValidator.validateName('collectionName', 'field name')).toThrow(
      `The name of field 'field name' you configured on 'collectionName' must not contain space.` +
        ` Something like 'fieldName' should work has expected.`,
    );
  });

  test('should not fail with a valid name', () => {
    expect(() => FieldValidator.validateName('collectionName', 'fieldName')).not.toThrow();
  });

  it('should throw a MissingFieldError when the field does not exist', () => {
    const collection = factories.collection.build({
      name: 'collection1',
      schema: {
        fields: {
          field1: { type: 'Column', columnType: 'String' },
        },
      },
    });

    expect(() => FieldValidator.validate(collection, 'INVALID')).toThrow(MissingFieldError);
  });
});
