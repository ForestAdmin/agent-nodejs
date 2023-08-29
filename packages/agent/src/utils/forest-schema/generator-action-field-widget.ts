import { ActionField, ActionFieldDropdown } from '@forestadmin/datasource-toolkit';
import {
  ForestServerActionFieldDropdownOptions,
  ForestServerActionFieldTextInputOptions,
} from '@forestadmin/forestadmin-client';

import ActionFields from './action-fields';

export default class GeneratorActionFieldWidget {
  static buildWidgetOptions(
    field: ActionField,
  ): ForestServerActionFieldDropdownOptions | ForestServerActionFieldTextInputOptions | undefined {
    if (!ActionFields.hasWidget(field) || ['Collection', 'Enum', 'EnumList'].includes(field.type))
      return undefined;

    switch (true) {
      case ActionFields.isDropdownField(field):
        return GeneratorActionFieldWidget.buildDropdownWidgetEdit(field);
      case ActionFields.isTextInputField(field):
        return GeneratorActionFieldWidget.buildTextInputWidgetEdit(field);
      default:
        throw new Error(`Unsupported widget type: ${field.widget}`);
    }
  }

  private static buildDropdownWidgetEdit(
    field: ActionFieldDropdown,
  ): ForestServerActionFieldDropdownOptions {
    return {
      name: 'dropdown',
      parameters: {
        isSearchable: field.search === 'static',
        placeholder: field.placeholder || null,
        static: {
          options: field.options || [],
        },
      },
    };
  }

  private static buildTextInputWidgetEdit(
    field: ActionFieldDropdown,
  ): ForestServerActionFieldTextInputOptions {
    return {
      name: 'text editor',
      parameters: {
        placeholder: field.placeholder || null,
      },
    };
  }
}
