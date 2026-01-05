import type {
  ActionField,
  ActionFieldAddressAutocomplete,
  ActionFieldCheckbox,
  ActionFieldCheckboxGroupAll,
  ActionFieldCollection,
  ActionFieldColorPicker,
  ActionFieldCurrencyInput,
  ActionFieldDatePickerInput,
  ActionFieldDropdown,
  ActionFieldDropdownAll,
  ActionFieldEnum,
  ActionFieldEnumList,
  ActionFieldFilePicker,
  ActionFieldJsonEditor,
  ActionFieldNumberInput,
  ActionFieldNumberInputList,
  ActionFieldRadioGroupButtonAll as ActionFieldRadioGroupAll,
  ActionFieldRichText,
  ActionFieldTextArea,
  ActionFieldTextInput,
  ActionFieldTextInputList,
  ActionFieldTimePicker,
  ActionFieldUserDropdown,
} from '@forestadmin/datasource-toolkit';

export default class ActionFields {
  public static isCollectionField(
    field: ActionField | null | undefined,
  ): field is ActionFieldCollection {
    return field?.type === 'Collection';
  }

  public static isEnumField(field: ActionField | null | undefined): field is ActionFieldEnum {
    return field?.type === 'Enum';
  }

  public static isEnumListField(
    field: ActionField | null | undefined,
  ): field is ActionFieldEnumList {
    return field?.type === 'EnumList';
  }

  public static isFileField(field: ActionField | null | undefined): boolean {
    return field?.type === 'File';
  }

  public static isFileListField(field: ActionField | null | undefined): boolean {
    return field?.type === 'FileList';
  }

  public static isDropdownField(
    field: ActionField | null | undefined,
  ): field is ActionFieldDropdownAll {
    return (field as ActionFieldDropdown)?.widget === 'Dropdown';
  }

  public static isRadioGroupField(
    field: ActionField | null | undefined,
  ): field is ActionFieldRadioGroupAll {
    return (field as ActionFieldRadioGroupAll)?.widget === 'RadioGroup';
  }

  public static isCheckboxGroupField(
    field: ActionField | null | undefined,
  ): field is ActionFieldCheckboxGroupAll {
    return (field as ActionFieldCheckboxGroupAll)?.widget === 'CheckboxGroup';
  }

  public static isCheckboxField(
    field: ActionField | null | undefined,
  ): field is ActionFieldCheckbox {
    return (field as ActionFieldCheckbox)?.widget === 'Checkbox';
  }

  public static isTextInputField(
    field: ActionField | null | undefined,
  ): field is ActionFieldTextInput {
    return (field as ActionFieldTextInput)?.widget === 'TextInput';
  }

  public static isDatePickerInputField(
    field: ActionField | null | undefined,
  ): field is ActionFieldDatePickerInput {
    return (field as ActionFieldDatePickerInput)?.widget === 'DatePicker';
  }

  public static isFilePickerField(
    field: ActionField | null | undefined,
  ): field is ActionFieldFilePicker {
    return (field as ActionFieldFilePicker)?.widget === 'FilePicker';
  }

  public static isTextInputListField(
    field: ActionField | null | undefined,
  ): field is ActionFieldTextInputList {
    return (field as ActionFieldTextInputList)?.widget === 'TextInputList';
  }

  public static isTextAreaField(
    field: ActionField | null | undefined,
  ): field is ActionFieldTextArea {
    return (field as ActionFieldTextArea)?.widget === 'TextArea';
  }

  public static isRichTextField(
    field: ActionField | null | undefined,
  ): field is ActionFieldRichText {
    return (field as ActionFieldRichText)?.widget === 'RichText';
  }

  public static isNumberInputField(
    field: ActionField | null | undefined,
  ): field is ActionFieldNumberInput {
    return (field as ActionFieldNumberInput)?.widget === 'NumberInput';
  }

  public static isColorPickerField(
    field: ActionField | null | undefined,
  ): field is ActionFieldColorPicker {
    return (field as ActionFieldColorPicker)?.widget === 'ColorPicker';
  }

  public static isNumberInputListField(
    field: ActionField | null | undefined,
  ): field is ActionFieldNumberInputList {
    return (field as ActionFieldNumberInputList)?.widget === 'NumberInputList';
  }

  public static isCurrencyInputField(
    field: ActionField | null | undefined,
  ): field is ActionFieldCurrencyInput {
    return (field as ActionFieldCurrencyInput)?.widget === 'CurrencyInput';
  }

  public static isUserDropdownField(
    field: ActionField | null | undefined,
  ): field is ActionFieldUserDropdown {
    return (field as ActionFieldUserDropdown)?.widget === 'UserDropdown';
  }

  public static isJsonEditorField(
    field: ActionField | null | undefined,
  ): field is ActionFieldJsonEditor {
    return (field as ActionField)?.widget === 'JsonEditor';
  }

  public static isAddressAutocompleteField(
    field: ActionField | null | undefined,
  ): field is ActionFieldAddressAutocomplete {
    return (field as ActionField)?.widget === 'AddressAutocomplete';
  }

  public static isTimePicker(
    field: ActionField | null | undefined,
  ): field is ActionFieldTimePicker {
    return (field as ActionFieldTimePicker)?.widget === 'TimePicker';
  }

  // Other types to be added here in the future ⤵
  public static hasWidget(
    field: ActionField | null | undefined,
  ): field is ActionField & { widget: string } {
    return Boolean((field as ActionFieldDropdown)?.widget);
  }
}
