import type { ActionForm, ActionFormField } from './agent-action-client';
import type { Logger } from '../ports/logger-port';
import type { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

import { sanitizeActionLayout } from './sanitize-action-html';
import { isEnumFieldType } from '../read-model/capabilities-cache';

export interface ActionFormFieldResponse {
  name: string;
  /** Verbatim from the agent, so a list type is `['String']` rather than `'StringList'`. */
  type: string | [string];
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

export function missingRequiredFieldNames(fields: ActionFormField[]): string[] {
  return fields
    .filter(field => field.isRequired())
    .filter(field => field.getValue() === undefined || field.getValue() === null)
    .map(field => field.getName());
}

// Mirrors the MCP getActionForm tool, adding `layout`. A required field is "missing a value" only
// when its resolved value is null/undefined; an explicit empty string or 0 counts as present.
export function mapActionForm(
  action: ActionForm,
  skippedFields: string[],
  layout: ForestServerActionFormLayoutElement[],
  logger: Logger,
): ActionFormResponse {
  const fields = action.getFields();

  const requiredFields = missingRequiredFieldNames(fields);

  return {
    fields: fields.map(field => {
      const base: ActionFormFieldResponse = {
        name: field.getName(),
        type: field.getType(),
        value: field.getValue(),
        isRequired: field.isRequired() ?? false,
      };

      // enumValues is emitted for every enum field, matching what the execute validator checks.
      if (isEnumFieldType(field.getType())) {
        return { ...base, enumValues: action.getEnumField(field.getName()).getOptions() ?? null };
      }

      return base;
    }),
    canExecute: requiredFields.length === 0,
    requiredFields,
    skippedFields,
    layout: sanitizeActionLayout(layout, logger),
  };
}
