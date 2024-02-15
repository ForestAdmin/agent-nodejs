import { ActionFieldTypeList } from '@forestadmin/datasource-toolkit';

import ActionFields from '../../../src/utils/forest-schema/action-fields';

describe('ActionFields', () => {
  describe('isCollectionField', () => {
    it('should return true when the field type is Collection', () => {
      const result = ActionFields.isCollectionField({
        type: 'Collection',
        label: 'Label',
        watchChanges: false,
      });

      expect(result).toBe(true);
    });

    it.each(ActionFieldTypeList.filter(type => type !== 'Collection'))(
      'should return false when the field type is %s',
      type => {
        const result = ActionFields.isCollectionField({
          type,
          label: 'Label',
          watchChanges: false,
        });

        expect(result).toBe(false);
      },
    );

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isCollectionField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isEnumField', () => {
    it('should return true when the field type is Enum', () => {
      const result = ActionFields.isEnumField({
        type: 'Enum',
        label: 'Label',
        watchChanges: false,
        enumValues: ['value1', 'value2'],
      });

      expect(result).toBe(true);
    });

    it.each(ActionFieldTypeList.filter(type => type !== 'Enum'))(
      'should return false when the field type is %s',
      type => {
        const result = ActionFields.isEnumField({
          type,
          label: 'Label',
          watchChanges: false,
        });

        expect(result).toBe(false);
      },
    );

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isEnumField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isEnumListField', () => {
    it('should return true when the field type is EnumList', () => {
      const result = ActionFields.isEnumListField({
        type: 'EnumList',
        label: 'Label',
        watchChanges: false,
        enumValues: ['value1', 'value2'],
      });

      expect(result).toBe(true);
    });

    it.each(ActionFieldTypeList.filter(type => type !== 'EnumList'))(
      'should return false when the field type is %s',
      type => {
        const result = ActionFields.isEnumListField({
          type,
          label: 'Label',
          watchChanges: false,
        });

        expect(result).toBe(false);
      },
    );

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isEnumListField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isFileField', () => {
    it('should return true when the field type is File', () => {
      const result = ActionFields.isFileField({
        type: 'File',
        label: 'Label',
        watchChanges: false,
      });

      expect(result).toBe(true);
    });

    it.each(ActionFieldTypeList.filter(type => type !== 'File'))(
      'should return false when the field type is %s',
      type => {
        const result = ActionFields.isFileField({
          type,
          label: 'Label',
          watchChanges: false,
        });

        expect(result).toBe(false);
      },
    );

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isFileField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isFileListField', () => {
    it('should return true when the field type is FileList', () => {
      const result = ActionFields.isFileListField({
        type: 'FileList',
        label: 'Label',
        watchChanges: false,
      });

      expect(result).toBe(true);
    });

    it.each(ActionFieldTypeList.filter(type => type !== 'FileList'))(
      'should return false when the field type is %s',
      type => {
        const result = ActionFields.isFileListField({
          type,
          label: 'Label',
          watchChanges: false,
        });

        expect(result).toBe(false);
      },
    );

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isFileListField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isDropdownField', () => {
    it('should return true when the field type is Dropdown', () => {
      const result = ActionFields.isDropdownField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
      });

      expect(result).toBe(true);
    });

    it('should return false when the field type is not Dropdown', () => {
      const result = ActionFields.isDropdownField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
      });

      expect(result).toBe(false);
    });

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isDropdownField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isRadioGroupField', () => {
    it('should return true when the field type is RadioGroup', () => {
      const result = ActionFields.isRadioGroupField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'RadioGroup',
      });

      expect(result).toBe(true);
    });

    it('should return false when the field type is not RadioGroup', () => {
      const result = ActionFields.isRadioGroupField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
      });

      expect(result).toBe(false);
    });

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isRadioGroupField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isCheckboxGroupField', () => {
    it('should return true when the field type is CheckboxGroup', () => {
      const result = ActionFields.isCheckboxGroupField({
        type: 'StringList',
        label: 'Label',
        watchChanges: false,
        widget: 'CheckboxGroup',
      });

      expect(result).toBe(true);
    });

    it('should return false when the field type is not CheckboxGroup', () => {
      const result = ActionFields.isCheckboxGroupField({
        type: 'StringList',
        label: 'Label',
        watchChanges: false,
      });

      expect(result).toBe(false);
    });

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isCheckboxGroupField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isCheckboxField', () => {
    it('should return true if the field is a checkbox', () => {
      const result = ActionFields.isCheckboxField({
        type: 'Boolean',
        label: 'Label',
        watchChanges: false,
        widget: 'Checkbox',
      });

      expect(result).toBe(true);
    });

    it('should return false if the field is not a checkbox', () => {
      const result = ActionFields.isCheckboxField({
        type: 'Boolean',
        label: 'Label',
        watchChanges: false,
        widget: 'TextInput' as any,
      });

      expect(result).toBe(false);
    });
  });

  describe('isTextInputField', () => {
    it('should return true if the field is a text input', () => {
      const result = ActionFields.isTextInputField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'TextInput',
      });

      expect(result).toBe(true);
    });

    it('should return false if the field is not a text input', () => {
      const result = ActionFields.isTextInputField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
        options: ['foo'],
      });

      expect(result).toBe(false);
    });
  });

  describe('isTextInputListField', () => {
    it('should return true if the field is a text input list', () => {
      const result = ActionFields.isTextInputListField({
        type: 'StringList',
        label: 'Label',
        watchChanges: false,
        widget: 'TextInputList',
      });

      expect(result).toBe(true);
    });

    it('should return false if the field is not a text input list', () => {
      const result = ActionFields.isTextInputListField({
        type: 'StringList',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
        options: ['foo'],
      });

      expect(result).toBe(false);
    });
  });

  describe('isTextAreaField', () => {
    it('should return true if the field is a text area', () => {
      const result = ActionFields.isTextAreaField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'TextArea',
      });

      expect(result).toBe(true);
    });

    it('should return false if the field is not a text area', () => {
      const result = ActionFields.isTextAreaField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
        options: ['foo'],
      });

      expect(result).toBe(false);
    });

    it('should return false if the field is undefined', () => {
      const result = ActionFields.isTextAreaField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isRichTextField', () => {
    it('should return true if the field is a rich text', () => {
      const result = ActionFields.isRichTextField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'RichText',
      });

      expect(result).toBe(true);
    });

    it('should return false if the field is not a rich text', () => {
      const result = ActionFields.isRichTextField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
        options: ['foo'],
      });

      expect(result).toBe(false);
    });

    it('should return false if the field is undefined', () => {
      const result = ActionFields.isRichTextField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isNumberInputField', () => {
    it('should return true if the field is a number input', () => {
      const result = ActionFields.isNumberInputField({
        type: 'Number',
        label: 'Label',
        watchChanges: false,
        widget: 'NumberInput',
      });

      expect(result).toBe(true);
    });

    it('should return false if the field is not a number input', () => {
      const result = ActionFields.isNumberInputField({
        type: 'Number',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
        options: ['foo'],
      });

      expect(result).toBe(false);
    });

    it('should return false if the field is undefined', () => {
      const result = ActionFields.isNumberInputField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isNumberInputListField', () => {
    it('should return true if the field is a number list input', () => {
      const result = ActionFields.isNumberInputListField({
        type: 'NumberList',
        label: 'Label',
        watchChanges: false,
        widget: 'NumberInputList',
      });

      expect(result).toBe(true);
    });

    it('should return false if the field is not a number list input', () => {
      const result = ActionFields.isNumberInputListField({
        type: 'NumberList',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
        options: [{ value: 2, label: 'foo' }],
      });

      expect(result).toBe(false);
    });

    it('should return false if the field is undefined', () => {
      const result = ActionFields.isNumberInputListField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isColorPickerField', () => {
    it('should return true if the field is a color input', () => {
      const result = ActionFields.isColorPickerField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'ColorPicker',
      });

      expect(result).toBe(true);
    });

    it('should return false if the field is not a color input', () => {
      const result = ActionFields.isColorPickerField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
        options: ['foo'],
      });

      expect(result).toBe(false);
    });

    it('should return false if the field is undefined', () => {
      const result = ActionFields.isColorPickerField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isCurrencyInputField', () => {
    it('should return true if the field is a currency input', () => {
      const result = ActionFields.isCurrencyInputField({
        type: 'Number',
        label: 'Label',
        watchChanges: false,
        widget: 'CurrencyInput',
        currency: 'USD',
      });

      expect(result).toBe(true);
    });

    it('should return false if the field is not a currency input', () => {
      const result = ActionFields.isCurrencyInputField({
        type: 'Number',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
        options: ['foo'],
      });

      expect(result).toBe(false);
    });

    it('should return false if the field is undefined', () => {
      const result = ActionFields.isCurrencyInputField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isJsonEditorField', () => {
    it('should return true if the field is a json editor', () => {
      const result = ActionFields.isJsonEditorField({
        type: 'Json',
        label: 'Label',
        watchChanges: false,
        widget: 'JsonEditor',
      });

      expect(result).toBe(true);
    });

    it('should return false if the field is not a json editor', () => {
      const result = ActionFields.isJsonEditorField({
        type: 'Json',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown' as any,
      });

      expect(result).toBe(false);
    });

    it('should return false if the field is undefined', () => {
      const result = ActionFields.isJsonEditorField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isUserDropdownField', () => {
    it('should return true if the field is a user input', () => {
      const result = ActionFields.isUserDropdownField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'UserDropdown',
        placeholder: '12',
      });

      expect(result).toBe(true);
    });

    it('should return false if the field is not a user input', () => {
      const result = ActionFields.isUserDropdownField({
        type: 'Number',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
        options: ['foo'],
      });

      expect(result).toBe(false);
    });

    it('should return false if the field is undefined', () => {
      const result = ActionFields.isUserDropdownField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isAddressAutocompleteField', () => {
    it('should return true if the field is an address autocomplete', () => {
      const result = ActionFields.isAddressAutocompleteField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'AddressAutocomplete',
      });

      expect(result).toBe(true);
    });

    it('should return false if the field is not an address autocomplete', () => {
      const result = ActionFields.isAddressAutocompleteField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown' as any,
      });

      expect(result).toBe(false);
    });

    it('should return false if the field is undefined', () => {
      const result = ActionFields.isAddressAutocompleteField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isFilePickerField', () => {
    it('should return true if the field is a file picker', () => {
      const result = ActionFields.isFilePickerField({
        type: 'File',
        label: 'Label',
        watchChanges: false,
        widget: 'FilePicker',
      });

      expect(result).toBe(true);
    });

    it('should return false when passing undefined', () => {
      const result = ActionFields.isFilePickerField(undefined);

      expect(result).toBe(false);
    });

    it('should return false when passing another type of widget', () => {
      const result = ActionFields.isFilePickerField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown' as any,
      });

      expect(result).toBe(false);
    });
  });

  describe('hasWidget', () => {
    it('should return true when the field has a widget', () => {
      const result = ActionFields.hasWidget({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        // @ts-expect-error widget could be anything at this point
        widget: 'ANY',
      });

      expect(result).toBe(true);
    });

    it('should return false when the field has no widget', () => {
      const result = ActionFields.hasWidget({
        type: 'String',
        label: 'Label',
        watchChanges: false,
      });

      expect(result).toBe(false);
    });

    it('should return false when the field is undefined', () => {
      const result = ActionFields.hasWidget(undefined);

      expect(result).toBe(false);
    });
  });
});
