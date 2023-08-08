import { ActionField, ActionFieldDropdown } from '@forestadmin/datasource-toolkit';
import { ForestServerActionFieldDropdownOptions } from '@forestadmin/forestadmin-client';

import ActionFields from './action-fields';

export default class GeneratorActionFieldWidget {
  static buildWidgetOptions(
    field: ActionField,
  ): ForestServerActionFieldDropdownOptions | undefined {
    if (!ActionFields.hasWidget(field) || ['Collection', 'Enum', 'EnumList'].includes(field.type))
      return undefined;

    switch (true) {
      case ActionFields.isDropdownField(field):
        return GeneratorActionFieldWidget.buildDropdownWidgetEdit(field);
      default:
        throw new Error(`Unsupported widget type: ${field.widget}`);
    }
  }

  private static buildDropdownWidgetEdit(
    field: ActionFieldDropdown,
  ): ForestServerActionFieldDropdownOptions {
    return {
      widget: 'dropdown',
      search: field.search || 'disabled',
      options: field.options || [],
    };
  }
}
