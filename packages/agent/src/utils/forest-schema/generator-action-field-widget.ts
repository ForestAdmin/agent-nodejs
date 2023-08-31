import {
  ActionField,
  ActionFieldDropdownAll,
  ActionFieldTextInputList,
} from '@forestadmin/datasource-toolkit';
import {
  ForestServerActionField,
  ForestServerActionFieldCheckboxOptions,
  ForestServerActionFieldDropdownOptions,
  ForestServerActionFieldTextInputListOptions,
  ForestServerActionFieldTextInputOptions,
} from '@forestadmin/forestadmin-client';

import ActionFields from './action-fields';

export default class GeneratorActionFieldWidget {
  static buildWidgetOptions(field: ActionField): ForestServerActionField['widgetEdit'] | undefined {
    if (!ActionFields.hasWidget(field) || ['Collection', 'Enum', 'EnumList'].includes(field.type))
      return undefined;

    if (ActionFields.isDropdownField(field))
      return GeneratorActionFieldWidget.buildDropdownWidgetEdit(field);

    if (ActionFields.isCheckboxField(field))
      return GeneratorActionFieldWidget.buildCheckboxWidgetEdit();

    if (ActionFields.isTextInputField(field))
      return GeneratorActionFieldWidget.buildTextInputWidgetEdit(field);

    if (ActionFields.isTextInputListField(field))
      return GeneratorActionFieldWidget.buildTextInputListWidgetEdit(field);

    throw new Error(`Unsupported widget type: ${(field as { widget: string }).widget}`);
  }

  private static buildDropdownWidgetEdit(
    field: ActionFieldDropdownAll,
  ):
    | ForestServerActionFieldDropdownOptions<string>
    | ForestServerActionFieldDropdownOptions<number> {
    return {
      name: 'dropdown',
      parameters: {
        isSearchable: field.search === 'static',
        placeholder: field.placeholder || null,
        static: {
          options: field.options || [],
        },
      },
    } as
      | ForestServerActionFieldDropdownOptions<number>
      | ForestServerActionFieldDropdownOptions<number>;
  }

  private static buildCheckboxWidgetEdit(): ForestServerActionFieldCheckboxOptions {
    return {
      name: 'boolean editor',
      parameters: {},
    };
  }

  private static buildTextInputWidgetEdit(
    field: ActionField,
  ): ForestServerActionFieldTextInputOptions {
    return {
      name: 'text editor',
      parameters: {
        placeholder: field.placeholder || null,
      },
    };
  }

  private static buildTextInputListWidgetEdit(
    field: ActionFieldTextInputList,
  ): ForestServerActionFieldTextInputListOptions {
    return {
      name: 'input array',
      parameters: {
        placeholder: field.placeholder || null,
        allowDuplicate: field.allowDuplicates || false,
        allowEmptyValue: field.allowEmptyValues || false,
        enableReorder: field.enableReorder ?? true,
      },
    };
  }
}
