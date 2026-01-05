import type { ActionContext, TFieldName, TRow, TSchema } from '@forestadmin/datasource-customizer';
import type { ActionResult } from '@forestadmin/datasource-toolkit';
import type { WebhookAction } from '@forestadmin/forestadmin-client';
import type { ResponseError } from 'superagent';

import { SchemaUtils } from '@forestadmin/datasource-toolkit';
import superagent from 'superagent';

function generateBody<S extends TSchema>(
  action: WebhookAction,
  records: TRow<S, Extract<keyof S, string>>[],
) {
  const commonPart = {
    action: {
      name: action.name,
      scope: action.configuration.scope.toLocaleLowerCase(),
    },
  };

  switch (action.configuration.scope) {
    case 'Global':
    case 'Bulk':
      return {
        ...commonPart,
        records,
      };
    case 'Single':
      if (records.length !== 1) {
        throw new Error('Single actions can only be used with one selected record');
      }

      return {
        ...commonPart,
        record: records[0],
      };
    default:
      throw new Error(`Unknown scope: ${action.configuration.scope}`);
  }
}

export default async function executeWebhook<S extends TSchema = TSchema>(
  action: WebhookAction,
  context: ActionContext<S>,
): Promise<ActionResult> {
  const primaryKeys = SchemaUtils.getPrimaryKeys(context.collection.schema) as TFieldName<
    S,
    Extract<keyof S, string>
  >[];

  const records = await context.getRecords(primaryKeys);

  const body = generateBody(action, records);

  try {
    await superagent.post(action.configuration.configuration.url).send(body);
  } catch (e) {
    if ((e as ResponseError).response) {
      return {
        type: 'Error',
        message: `Error received from the webhook endpoint: ${e.status} ${e.message}.`,
      };
    }

    return {
      type: 'Error',
      message: `Could not execute the action: ${e.message}.`,
    };
  }
}
