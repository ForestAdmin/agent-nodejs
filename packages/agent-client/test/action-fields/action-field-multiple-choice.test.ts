import type { PlainField, PlainFieldOption } from '../../src/action-fields/types';

import ActionFieldMultipleChoice from '../../src/action-fields/action-field-multiple-choice';

describe('ActionFieldMultipleChoice', () => {
  const createPlainField = (options?: PlainFieldOption[], value?: unknown): PlainField => ({
    field: 'testField',
    type: 'String',
    isRequired: false,
    isReadOnly: false,
    value,
    widgetEdit: {
      parameters: {
        static: {
          options,
        },
      },
    },
  });

  describe('getOptions', () => {
    it('should return the options from widgetEdit', () => {
      const options: PlainFieldOption[] = [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
      ];
      const field = new ActionFieldMultipleChoice(createPlainField(options));

      expect(field.getOptions()).toEqual(options);
    });

    it('should return undefined when no options are set', () => {
      const plainField: PlainField = {
        field: 'testField',
        type: 'String',
        isRequired: false,
        isReadOnly: false,
      };
      const field = new ActionFieldMultipleChoice(plainField);

      expect(field.getOptions()).toBeUndefined();
    });
  });

  describe('getOption', () => {
    it('should return the option matching the label', () => {
      const options: PlainFieldOption[] = [
        { label: 'First', value: 'first_value' },
        { label: 'Second', value: 'second_value' },
      ];
      const field = new ActionFieldMultipleChoice(createPlainField(options));

      expect(field.getOption('First')).toEqual({ label: 'First', value: 'first_value' });
      expect(field.getOption('Second')).toEqual({ label: 'Second', value: 'second_value' });
    });

    it('should throw error when option is not found', () => {
      const options: PlainFieldOption[] = [{ label: 'Existing', value: 'existing' }];
      const field = new ActionFieldMultipleChoice(createPlainField(options));

      expect(() => field.getOption('NonExistent')).toThrow(
        'Option "NonExistent" not found in field "testField"',
      );
    });

    it('should throw error when options are undefined', () => {
      const plainField: PlainField = {
        field: 'emptyField',
        type: 'String',
        isRequired: false,
        isReadOnly: false,
      };
      const field = new ActionFieldMultipleChoice(plainField);

      expect(() => field.getOption('Any')).toThrow('Option "Any" not found in field "emptyField"');
    });
  });
});
