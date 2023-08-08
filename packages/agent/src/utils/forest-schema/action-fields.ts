import {
  ActionField,
  ActionFieldCollection,
  ActionFieldDropdown,
  ActionFieldEnum,
  ActionFieldEnumList,
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
  ): field is ActionFieldDropdown {
    return (field as ActionFieldDropdown)?.widget === 'Dropdown';
  }

  // Other types to be added here in the future ⤵
  public static hasWidget(field: ActionField | null | undefined): field is ActionFieldDropdown {
    return Boolean((field as ActionFieldDropdown)?.widget);
  }
}
