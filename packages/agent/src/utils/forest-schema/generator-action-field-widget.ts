import { ActionField } from '@forestadmin/datasource-toolkit';
import {
  ForestServerActionFieldWidgetEdit,
  ForestServerActionFieldWidgetEditDropdown,
} from '@forestadmin/forestadmin-client';

export default class GeneratorActionFieldWidget {
  static buildWidgetEdit(field: ActionField): ForestServerActionFieldWidgetEdit | undefined {
    if (!field.widget || ['Collection', 'Enum', 'EnumList'].includes(field.type)) return undefined;

    switch (field.widget) {
      case 'Dropdown':
        return GeneratorActionFieldWidget.buildDropdownWidgetEdit(field);
      default:
        throw new Error(`Unsupported widget type: ${field.widget}`);
    }
  }

  private static buildDropdownWidgetEdit(
    field: ActionField,
  ): ForestServerActionFieldWidgetEditDropdown {
    return {
      name: 'dropdown',
      parameters: {
        search: field.search || 'disabled',
        options: field.options || [],
      },
    };
  }
}
