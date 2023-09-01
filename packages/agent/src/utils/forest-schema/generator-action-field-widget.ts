import {
  ActionField,
  ActionFieldCheckboxGroupAll,
  ActionFieldDropdownAll,
  ActionFieldRadioGroupButtonAll,
  ActionFieldRichText,
  ActionFieldTextArea,
  ActionFieldTextInputList,
} from '@forestadmin/datasource-toolkit';
import {
  ForestServerActionField,
  ForestServerActionFieldCheckboxGroupOptions,
  ForestServerActionFieldCheckboxOptions,
  ForestServerActionFieldDropdownOptions,
  ForestServerActionFieldRadioButtonOptions,
  ForestServerActionFieldRichTextOptions,
  ForestServerActionFieldTextAreaOptions,
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

    if (ActionFields.isRadioGroupField(field))
      return GeneratorActionFieldWidget.buildRadioGroupWidgetEdit(field);

    if (ActionFields.isCheckboxGroupField(field))
      return GeneratorActionFieldWidget.buildCheckboxGroupWidgetEdit(field);

    if (ActionFields.isCheckboxField(field))
      return GeneratorActionFieldWidget.buildCheckboxWidgetEdit();

    if (ActionFields.isTextInputField(field))
      return GeneratorActionFieldWidget.buildTextInputWidgetEdit(field);

    if (ActionFields.isTextInputListField(field))
      return GeneratorActionFieldWidget.buildTextInputListWidgetEdit(field);

    if (ActionFields.isTextAreaField(field))
      return GeneratorActionFieldWidget.buildTextAreaWidgetEdit(field);

    if (ActionFields.isRichTextField(field))
      return GeneratorActionFieldWidget.buildRichTextWidgetEdit(field);

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

  private static buildRadioGroupWidgetEdit(
    field: ActionFieldRadioGroupButtonAll,
  ):
    | ForestServerActionFieldRadioButtonOptions<string>
    | ForestServerActionFieldRadioButtonOptions<number> {
    return {
      name: 'radio button',
      parameters: {
        static: {
          options: field.options || [],
        },
      },
    } as
      | ForestServerActionFieldRadioButtonOptions<string>
      | ForestServerActionFieldRadioButtonOptions<number>;
  }

  private static buildCheckboxGroupWidgetEdit(
    field: ActionFieldCheckboxGroupAll,
  ):
    | ForestServerActionFieldCheckboxGroupOptions<string>
    | ForestServerActionFieldCheckboxGroupOptions<number> {
    return {
      name: 'checkboxes',
      parameters: {
        static: {
          options: field.options || [],
        },
      },
    } as
      | ForestServerActionFieldCheckboxGroupOptions<string>
      | ForestServerActionFieldCheckboxGroupOptions<number>;
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

  private static buildTextAreaWidgetEdit(
    field: ActionFieldTextArea,
  ): ForestServerActionFieldTextAreaOptions {
    return {
      name: 'text area editor',
      parameters: {
        placeholder: field.placeholder || null,
        rows: Number(field.rows) && field.rows > 0 ? Math.round(field.rows) : null,
      },
    };
  }

  private static buildRichTextWidgetEdit(
    field: ActionFieldRichText,
  ): ForestServerActionFieldRichTextOptions {
    return {
      name: 'rich text',
      parameters: {
        placeholder: field.placeholder || null,
      },
    };
  }
}
