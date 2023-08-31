import {
  ActionField,
  ActionFieldCheckbox,
  ActionFieldCollection,
  ActionFieldDropdown,
  ActionFieldDropdownAll,
  ActionFieldEnum,
  ActionFieldEnumList,
  ActionFieldTextArea,
  ActionFieldTextInput,
  ActionFieldTextInputList,
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

  // Other types to be added here in the future ⤵
  public static hasWidget(
    field: ActionField | null | undefined,
  ): field is
    | ActionFieldDropdownAll
    | ActionFieldCheckbox
    | ActionFieldTextInput
    | ActionFieldTextInputList {
    return Boolean((field as ActionFieldDropdown)?.widget);
  }
}
