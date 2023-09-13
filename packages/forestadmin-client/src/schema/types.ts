import type { PrimitiveTypes } from '@forestadmin/datasource-toolkit';

export type ForestSchema = {
  collections: ForestServerCollection[];
  meta: {
    liana: string;
    liana_version: string;
    liana_features: Record<string, string> | null;
    stack: {
      engine: string;
      engine_version: string;
    };
  };
};

export type ForestServerColumnType =
  | PrimitiveTypes
  | [ForestServerColumnType]
  | { fields: Array<{ field: string; type: ForestServerColumnType }> };

export type ForestServerCollection = {
  name: string;
  icon: null;
  integration: null;
  isReadOnly: boolean;
  isSearchable: boolean;
  isVirtual: false;
  onlyForRelationships: boolean;
  paginationType: 'page';
  actions: Array<ForestServerAction>;
  fields: Array<ForestServerField>;
  segments: Array<ForestServerSegment>;
};

export type ForestServerAction = {
  id: string;
  name: string;
  type: 'single' | 'bulk' | 'global';
  baseUrl: string;
  endpoint: string;
  httpMethod: 'POST';
  redirect: unknown;
  download: boolean;
  fields: ForestServerActionField[];
  hooks: {
    load: boolean;
    change: Array<unknown>;
  };
};

export type ForestServerActionFieldWidgetEditBase<TType = string, TConfig = unknown> = {
  name: TType;
  parameters: TConfig;
};

export type WidgetEditConfiguration = {
  name: string;
  parameters: Record<string, unknown>;
};

export type ForestServerActionFieldCommon<
  TType extends ForestServerColumnType = ForestServerColumnType,
  TWidgetEdit extends WidgetEditConfiguration = null,
> = {
  type: TType;
  value: unknown;
  defaultValue: unknown;
  description: string | null;
  field: string;
  hook: string;
  isReadOnly: boolean;
  isRequired: boolean;
  enums: null | string[];
  widgetEdit: TWidgetEdit;
};

export type ForestServerActionFieldBase = ForestServerActionFieldCommon & {
  reference: string | null;
};

type ForestServerActionFieldLimitedValueOptions<
  TName extends string,
  TValue = string,
  TParameters = Record<string, never>,
> = {
  name: TName;
  parameters: {
    static: {
      options: Array<{ label: string; value: TValue } | TValue>;
    };
  } & TParameters;
};

export type ForestServerActionFieldDropdownOptions<TValue = string> =
  ForestServerActionFieldLimitedValueOptions<
    'dropdown',
    TValue,
    {
      placeholder?: string | null;
      isSearchable?: boolean;
    }
  >;

export type ForestServerActionFieldRadioButtonOptions<TValue = string> =
  ForestServerActionFieldLimitedValueOptions<'radio button', TValue>;

export type ForestServerActionFieldCheckboxGroupOptions<TValue = string> =
  ForestServerActionFieldLimitedValueOptions<'checkboxes', TValue>;

export type ForestServerActionFieldCheckboxOptions = {
  name: 'boolean editor';
  parameters: Record<string, never>;
};

export type ForestServerActionFieldTextInputOptions = {
  name: 'text editor';
  parameters: {
    placeholder?: string | null;
  };
};

export type ForestServerActionFieldDatePickerInputOptions = {
  name: 'date editor';
  parameters: {
    format?: string | null;
    placeholder?: string | null;
    minDate?: string;
    maxDate?: string;
  };
};

export type ForestServerActionFieldTextInputListOptions = {
  name: 'input array';
  parameters: {
    placeholder?: string | null;
    enableReorder?: boolean;
    allowDuplicate?: boolean;
    allowEmptyValue?: boolean;
  };
};

export type ForestServerActionFieldTextAreaOptions = {
  name: 'text area editor';
  parameters: {
    placeholder?: string | null;
    rows?: number;
  };
};

export type ForestServerActionFieldRichTextOptions = {
  name: 'rich text';
  parameters: {
    placeholder?: string | null;
  };
};

export type ForestServerActionFieldNumberInputOptions = {
  name: 'number input';
  parameters: {
    placeholder?: string | null;
    min?: number;
    max?: number;
    step?: number;
  };
};

export type ForestServerActionFieldNumberInputListOptions = {
  name: 'input array';
  parameters: {
    placeholder?: string | null;
    enableReorder?: boolean;
    allowDuplicate?: boolean;
    min?: number;
    max?: number;
    step?: number;
  };
};

export type ForestServerActionFieldColorPickerOptions = {
  name: 'color editor';
  parameters: {
    placeholder?: string | null;
    enableOpacity?: boolean;
    quickPalette?: string[];
  };
};

export type ForestServerActionFieldCurrencyInputOptions = {
  name: 'price editor';
  parameters: {
    placeholder?: string | null;
    min?: number;
    max?: number;
    step?: number;
    currency: string;
    base: 'Unit' | 'Cents';
  };
};

export type ForestServerActionFieldDropdown =
  | ForestServerActionFieldCommon<
      'String' | 'Dateonly' | 'Date' | 'Timeonly',
      ForestServerActionFieldDropdownOptions<string>
    >
  | ForestServerActionFieldCommon<['String'], ForestServerActionFieldDropdownOptions<string[]>>
  | ForestServerActionFieldCommon<'Number', ForestServerActionFieldDropdownOptions<number>>;

export type ForestServerActionFieldRadioGroup =
  | ForestServerActionFieldCommon<
      'String' | 'Dateonly' | 'Date' | 'Timeonly',
      ForestServerActionFieldRadioButtonOptions<string>
    >
  | ForestServerActionFieldCommon<'Number', ForestServerActionFieldRadioButtonOptions<number>>;

export type ForestServerActionFieldCheckboxGroup =
  | ForestServerActionFieldCommon<['String'], ForestServerActionFieldCheckboxGroupOptions<string>>
  | ForestServerActionFieldCommon<['Number'], ForestServerActionFieldCheckboxGroupOptions<number>>;

export type ForestServerActionField =
  | ForestServerActionFieldDropdown
  | ForestServerActionFieldRadioGroup
  | ForestServerActionFieldCheckboxGroup
  | ForestServerActionFieldBase
  | ForestServerActionFieldCommon<'Boolean', ForestServerActionFieldCheckboxOptions>
  | ForestServerActionFieldCommon<'String', ForestServerActionFieldTextInputOptions>
  | ForestServerActionFieldCommon<'Date', ForestServerActionFieldDatePickerInputOptions>
  | ForestServerActionFieldCommon<['String'], ForestServerActionFieldTextInputListOptions>
  | ForestServerActionFieldCommon<'String', ForestServerActionFieldTextAreaOptions>
  | ForestServerActionFieldCommon<'String', ForestServerActionFieldRichTextOptions>
  | ForestServerActionFieldCommon<'Number', ForestServerActionFieldNumberInputOptions>
  | ForestServerActionFieldCommon<'Number', ForestServerActionFieldCurrencyInputOptions>
  | ForestServerActionFieldCommon<['Number'], ForestServerActionFieldNumberInputListOptions>
  | ForestServerActionFieldCommon<'String', ForestServerActionFieldColorPickerOptions>;

export type ForestServerField = Partial<{
  field: string;
  type: ForestServerColumnType;
  defaultValue: unknown;
  enums: null | string[];
  integration: null; // Always null on forest-express
  isFilterable: boolean;
  isPrimaryKey: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isSortable: boolean;
  isVirtual: boolean; // Computed. Not sure what is done with that knowledge on the frontend.
  reference: null | string;
  inverseOf: null | string;
  relationship: 'BelongsTo' | 'BelongsToMany' | 'HasMany' | 'HasOne';
  validations: Array<{ message: string | null; type: ValidationType; value?: unknown }>;
}>;

export type ForestServerSegment = {
  id: string;
  name: string;
};

export type ValidationType =
  | 'contains'
  | 'is after'
  | 'is before'
  | 'is greater than'
  | 'is less than'
  | 'is like'
  | 'is longer than'
  | 'is present'
  | 'is shorter than';
