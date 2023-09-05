import {
  ActionField,
  ActionFieldCheckboxGroupAll,
  ActionFieldDropdownAll,
  ActionFieldNumberInput,
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
  ForestServerActionFieldNumberInputOptions,
  ForestServerActionFieldRadioButtonOptions,
  ForestServerActionFieldRichTextOptions,
  ForestServerActionFieldTextAreaOptions,
  ForestServerActionFieldTextInputListOptions,
  ForestServerActionFieldTextInputOptions,
} from '@forestadmin/forestadmin-client';

import ActionFields from './action-fields';

type DropdownWidgetEdit =
  | ForestServerActionFieldDropdownOptions<string>
  | ForestServerActionFieldDropdownOptions<number>;

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

    if (ActionFields.isNumberInputField(field))
      return GeneratorActionFieldWidget.buildNumberInputWidgetEdit(field);

    throw new Error(`Unsupported widget type: ${(field as { widget: string }).widget}`);
  }

  private static buildDropdownWidgetEdit(field: ActionFieldDropdownAll): DropdownWidgetEdit {
    const widgetEdit: { [k: string]: any } = {
      name: 'dropdown',
      parameters: {
        isSearchable: ['static', 'dynamic'].includes(field.search),
        placeholder: field.placeholder || null,
      },
    };

    switch (field.search) {
      case 'static':
        widgetEdit.parameters.static = {
          options: field.options || [],
        };
        break;
      case 'dynamic':
        /*         widgetEdit.parameters.dynamic = {
          simple: null,
          smart: { path: '/forest/_actions/card/0/search/hooks/search' },
        }; */
        widgetEdit.parameters.dynamic = {
          agent: {},
        };
        break;

      default:
        break;
    }

    return widgetEdit as DropdownWidgetEdit;
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
        rows:
          GeneratorActionFieldWidget.isValidNumber(field.rows) && field.rows > 0
            ? Math.round(field.rows)
            : null,
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

  private static buildNumberInputWidgetEdit(
    field: ActionFieldNumberInput,
  ): ForestServerActionFieldNumberInputOptions {
    return {
      name: 'number input',
      parameters: {
        placeholder: field.placeholder || null,
        min: GeneratorActionFieldWidget.isValidNumber(field.min) ? field.min : null,
        max: GeneratorActionFieldWidget.isValidNumber(field.max) ? field.max : null,
        step: GeneratorActionFieldWidget.isValidNumber(field.step) ? field.step : null,
      },
    };
  }

  private static isValidNumber(value: unknown): boolean {
    return ![null, undefined].includes(value) && !Number.isNaN(Number(value));
  }
}
