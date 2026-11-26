import type { ActionForm } from './agent-action-client';
import type { Logger } from '../ports/logger-port';
import type { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

import { describeActionForm } from '@forestadmin/agent-client';

import { sanitizeActionLayout } from './sanitize-action-html';

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

// A required field is "missing a value" only when its resolved value is null/undefined; an explicit
// empty string or 0 counts as present.
export function mapActionForm(
  action: ActionForm,
  skippedFields: string[],
  layout: ForestServerActionFormLayoutElement[],
  logger: Logger,
): ActionFormResponse {
  const { fields, requiredFields, canExecute } = describeActionForm(action);

  return {
    fields: fields.map(({ name, type, value, isRequired, enumValues }) => ({
      name,
      type,
      value,
      isRequired,
      ...(enumValues !== undefined && { enumValues }),
    })),
    canExecute,
    requiredFields,
    skippedFields,
    layout: sanitizeActionLayout(layout, logger),
  };
}
