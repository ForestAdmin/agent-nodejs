import {
  ActionField,
  ActionFieldAddressAutocomplete,
  ActionFieldCheckboxGroupAll,
  ActionFieldColorPicker,
  ActionFieldCurrencyInput,
  ActionFieldDropdownAll,
  ActionFieldFilePicker,
  ActionFieldNumberInput,
  ActionFieldNumberInputList,
  ActionFieldRadioGroupButtonAll,
  ActionFieldRichText,
  ActionFieldTextArea,
  ActionFieldTextInputList,
  ActionFieldUserDropdown,
  ActionInputField,
} from '@forestadmin/datasource-toolkit';
import {
  ForestServerActionFieldAddressAutocompleteOptions,
  ForestServerActionFieldCheckboxGroupOptions,
  ForestServerActionFieldCheckboxOptions,
  ForestServerActionFieldColorPickerOptions,
  ForestServerActionFieldCurrencyInputOptions,
  ForestServerActionFieldDatePickerInputOptions,
  ForestServerActionFieldDropdownOptions,
  ForestServerActionFieldFilePickerOptions,
  ForestServerActionFieldJsonEditorOptions,
  ForestServerActionFieldNumberInputListOptions,
  ForestServerActionFieldNumberInputOptions,
  ForestServerActionFieldRadioButtonOptions,
  ForestServerActionFieldRichTextOptions,
  ForestServerActionFieldTextAreaOptions,
  ForestServerActionFieldTextInputListOptions,
  ForestServerActionFieldTextInputOptions,
  ForestServerActionFieldTimePickerOptions,
  ForestServerActionFieldUserDropdown,
  ForestServerActionInputField,
} from '@forestadmin/forestadmin-client';

import ActionFields from './action-fields';

export default class GeneratorActionFieldWidget {
  static buildWidgetOptions(
    field: ActionField,
  ): ForestServerActionInputField['widgetEdit'] | undefined {
    if (!ActionFields.hasWidget(field) || ['Collection', 'Enum', 'EnumList'].includes(field.type)) {
      return undefined;
    }

    if (ActionFields.isDropdownField(field)) {
      return GeneratorActionFieldWidget.buildDropdownWidgetEdit(field);
    }

    if (ActionFields.isRadioGroupField(field)) {
      return GeneratorActionFieldWidget.buildRadioGroupWidgetEdit(field);
    }

    if (ActionFields.isCheckboxGroupField(field)) {
      return GeneratorActionFieldWidget.buildCheckboxGroupWidgetEdit(field);
    }

    if (ActionFields.isCheckboxField(field)) {
      return GeneratorActionFieldWidget.buildCheckboxWidgetEdit();
    }

    if (ActionFields.isTextInputField(field)) {
      return GeneratorActionFieldWidget.buildTextInputWidgetEdit(field);
    }

    if (ActionFields.isDatePickerInputField(field)) {
      return GeneratorActionFieldWidget.buildDatePickerInputWidgetEdit(field);
    }

    if (ActionFields.isTextInputListField(field)) {
      return GeneratorActionFieldWidget.buildTextInputListWidgetEdit(field);
    }

    if (ActionFields.isTextAreaField(field)) {
      return GeneratorActionFieldWidget.buildTextAreaWidgetEdit(field);
    }

    if (ActionFields.isRichTextField(field)) {
      return GeneratorActionFieldWidget.buildRichTextWidgetEdit(field);
    }

    if (ActionFields.isNumberInputField(field)) {
      return GeneratorActionFieldWidget.buildNumberInputWidgetEdit(field);
    }

    if (ActionFields.isColorPickerField(field)) {
      return GeneratorActionFieldWidget.buildColorPickerWidgetEdit(field);
    }

    if (ActionFields.isNumberInputListField(field)) {
      return GeneratorActionFieldWidget.buildNumberInputListWidgetEdit(field);
    }

    if (ActionFields.isCurrencyInputField(field)) {
      return GeneratorActionFieldWidget.buildCurrencyInputWidgetEdit(field);
    }

    if (ActionFields.isUserDropdownField(field)) {
      return GeneratorActionFieldWidget.buildUserDropdownWidgetEdit(field);
    }

    if (ActionFields.isTimePicker(field)) {
      return GeneratorActionFieldWidget.buildTimePickerWidgetEdit();
    }

    if (ActionFields.isJsonEditorField(field)) {
      return GeneratorActionFieldWidget.buildJsonEditorWidgetEdit();
    }

    if (ActionFields.isFilePickerField(field)) {
      return GeneratorActionFieldWidget.buildFilePickerWidgetEdit(field);
    }

    if (ActionFields.isAddressAutocompleteField(field)) {
      return GeneratorActionFieldWidget.buildAddressAutocompleteWidgetEdit(field);
    }

    throw new Error(`Unsupported widget type: ${(field as { widget: string }).widget}`);
  }

  private static buildDropdownWidgetEdit(field: ActionFieldDropdownAll) {
    return {
      name: 'dropdown',
      parameters: {
        searchType: field.search === 'dynamic' ? 'dynamic' : null,
        isSearchable: ['static', 'dynamic'].includes(field.search),
        placeholder: field.placeholder || null,
        static: { options: field.options || [] },
      },
    } as
      | ForestServerActionFieldDropdownOptions<string>
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
    field: ActionInputField,
  ): ForestServerActionFieldTextInputOptions {
    return {
      name: 'text editor',
      parameters: {
        placeholder: field.placeholder || null,
      },
    };
  }

  private static buildDatePickerInputWidgetEdit(
    field: ActionInputField,
  ): ForestServerActionFieldDatePickerInputOptions {
    return {
      name: 'date editor',
      parameters: {
        format: field.format || null,
        placeholder: field.placeholder || null,
        minDate: field.min instanceof Date ? field.min.toISOString() : null,
        maxDate: field.max instanceof Date ? field.max.toISOString() : null,
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

  private static buildColorPickerWidgetEdit(
    field: ActionFieldColorPicker,
  ): ForestServerActionFieldColorPickerOptions {
    return {
      name: 'color editor',
      parameters: {
        placeholder: field.placeholder || null,
        enableOpacity: field.enableOpacity || false,
        quickPalette: field.quickPalette?.length ? field.quickPalette : null,
      },
    };
  }

  private static buildNumberInputListWidgetEdit(
    field: ActionFieldNumberInputList,
  ): ForestServerActionFieldNumberInputListOptions {
    return {
      name: 'input array',
      parameters: {
        placeholder: field.placeholder || null,
        allowDuplicate: field.allowDuplicates || false,
        enableReorder: field.enableReorder ?? true,
        min: GeneratorActionFieldWidget.isValidNumber(field.min) ? field.min : null,
        max: GeneratorActionFieldWidget.isValidNumber(field.max) ? field.max : null,
        step: GeneratorActionFieldWidget.isValidNumber(field.step) ? field.step : null,
      },
    };
  }

  private static buildTimePickerWidgetEdit(): ForestServerActionFieldTimePickerOptions {
    return {
      name: 'time editor',
      parameters: {},
    };
  }

  private static buildCurrencyInputWidgetEdit(
    field: ActionFieldCurrencyInput,
  ): ForestServerActionFieldCurrencyInputOptions {
    return {
      name: 'price editor',
      parameters: {
        placeholder: field.placeholder || null,
        min: GeneratorActionFieldWidget.isValidNumber(field.min) ? field.min : null,
        max: GeneratorActionFieldWidget.isValidNumber(field.max) ? field.max : null,
        step: GeneratorActionFieldWidget.isValidNumber(field.step) ? field.step : null,
        currency:
          field.currency && typeof field.currency === 'string' && field.currency?.length === 3
            ? field.currency?.toUpperCase()
            : null, // Default value handled by the frontend
        base: GeneratorActionFieldWidget.mapCurrencyBase(field.base),
      },
    };
  }

  private static mapCurrencyBase(base: string): 'Unit' | 'Cents' {
    switch (base?.toLowerCase()) {
      case 'cent':
      case 'cents':
        return 'Cents';

      case 'unit':
      case 'units':
      default:
        return 'Unit';
    }
  }

  private static buildUserDropdownWidgetEdit(
    field: ActionFieldUserDropdown,
  ): ForestServerActionFieldUserDropdown {
    return {
      name: 'assignee editor',
      parameters: {
        placeholder: field.placeholder || null,
      },
    };
  }

  private static isValidNumber(value: unknown): boolean {
    return ![null, undefined].includes(value) && !Number.isNaN(Number(value));
  }

  private static buildJsonEditorWidgetEdit(): ForestServerActionFieldJsonEditorOptions {
    return {
      name: 'json code editor',
      parameters: {},
    };
  }

  private static buildFilePickerWidgetEdit(
    field: ActionFieldFilePicker,
  ): ForestServerActionFieldFilePickerOptions {
    return {
      name: 'file picker',
      parameters: {
        prefix: null,
        filesExtensions: field.extensions || null,
        filesSizeLimit: field.maxSizeMb || null,
        filesCountLimit: field.maxCount || null,
      },
    };
  }

  private static buildAddressAutocompleteWidgetEdit(
    field: ActionFieldAddressAutocomplete,
  ): ForestServerActionFieldAddressAutocompleteOptions {
    return {
      name: 'address editor',
      parameters: {
        placeholder: field.placeholder || null,
      },
    };
  }
}
