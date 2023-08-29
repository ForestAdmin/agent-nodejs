import { ActionField, ActionFieldDropdownAll } from '@forestadmin/datasource-toolkit';
import {
  ForestServerActionFieldCheckboxOptions,
  ForestServerActionFieldDropdownOptions,
  ForestServerActionFieldTextInputOptions,
} from '@forestadmin/forestadmin-client';

import ActionFields from './action-fields';

export default class GeneratorActionFieldWidget {
  static buildWidgetOptions(
    field: ActionField,
  ):
    | ForestServerActionFieldDropdownOptions<string>
    | ForestServerActionFieldDropdownOptions<number>
    | ForestServerActionFieldCheckboxOptions
    | ForestServerActionFieldTextInputOptions
    | undefined {
    if (!ActionFields.hasWidget(field) || ['Collection', 'Enum', 'EnumList'].includes(field.type))
      return undefined;

    switch (true) {
      case ActionFields.isDropdownField(field):
        return GeneratorActionFieldWidget.buildDropdownWidgetEdit(field);
      case ActionFields.isCheckboxField(field):
        return GeneratorActionFieldWidget.buildCheckboxWidgetEdit();
      case ActionFields.isTextInputField(field):
        return GeneratorActionFieldWidget.buildTextInputWidgetEdit(field);
      default:
        throw new Error(`Unsupported widget type: ${field.widget}`);
    }
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
}
