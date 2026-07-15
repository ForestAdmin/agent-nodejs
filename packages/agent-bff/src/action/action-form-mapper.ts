import type { ActionForm } from './agent-action-client';
import type { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

const ENUM_TYPE = 'Enum';

export interface ActionFormFieldResponse {
  name: string;
  type: string;
  value: unknown;
  isRequired: boolean;
  enumValues?: string[] | null;
}

export interface ActionFormResponse {
  fields: ActionFormFieldResponse[];
  canExecute: boolean;
  requiredFields: string[];
  skippedFields: string[];
  layout: ForestServerActionFormLayoutElement[];
}

// Mirrors the MCP getActionForm tool, adding `layout`. A required field is "missing a value" only
// when its resolved value is null/undefined; an explicit empty string or 0 counts as present.
export function mapActionForm(
  action: ActionForm,
  skippedFields: string[],
  layout: ForestServerActionFormLayoutElement[],
): ActionFormResponse {
  const fields = action.getFields();

  const requiredFields = fields
    .filter(field => field.isRequired())
    .filter(field => field.getValue() === undefined || field.getValue() === null)
    .map(field => field.getName());

  return {
    fields: fields.map(field => {
      const base: ActionFormFieldResponse = {
        name: field.getName(),
        type: field.getType(),
        value: field.getValue(),
        isRequired: field.isRequired() ?? false,
      };

      // enumValues is emitted only for Enum fields, matching the MCP tool.
      if (field.getType() === ENUM_TYPE) {
        return { ...base, enumValues: action.getEnumField(field.getName()).getOptions() ?? null };
      }

      return base;
    }),
    canExecute: requiredFields.length === 0,
    requiredFields,
    skippedFields,
    layout,
  };
}
