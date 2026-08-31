import type { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

export type ResponseBody = {
  fields: PlainField[];
  layout?: ForestServerActionFormLayoutElement[];
};

export type PlainFieldOption = {
  label: string;
  value: string;
};

export type PlainField = {
  field: string;
  // Agents emit list types as a single-element array, e.g. ['File'] or ['String'].
  type: string | [string];
  description?: string;
  value?: unknown;
  isRequired: boolean;
  isReadOnly: boolean;
  hook?: string;
  widgetEdit?: {
    name?: string;
    parameters: {
      static: {
        options?: PlainFieldOption[];
        enableOpacity?: boolean;
        quickPalette?: string[];
      };
    };
  };
  enums?: string[];
};
