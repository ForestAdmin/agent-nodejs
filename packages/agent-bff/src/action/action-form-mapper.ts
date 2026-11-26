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

export function mapActionForm(
  action: ActionForm,
  skippedFields: string[],
  layout: ForestServerActionFormLayoutElement[],
  logger: Logger,
): ActionFormResponse {
  const { fields, requiredFields } = describeActionForm(action);

  return {
    fields: fields.map(({ name, type, value, isRequired, enumValues }) => ({
      name,
      type,
      value,
      isRequired,
      ...(enumValues !== undefined && { enumValues }),
    })),
    canExecute: requiredFields.length === 0,
    requiredFields,
    skippedFields,
    layout: sanitizeActionLayout(layout, logger),
  };
}
