import { ActionContext, TFieldName, TRow, TSchema } from '@forestadmin/datasource-customizer';
import { ActionScope, SchemaUtils } from '@forestadmin/datasource-toolkit';
import superagent from 'superagent';

import { CollectionCustomizer } from '../..';

function generateBody<S extends TSchema>(
  {
    name,
    scope,
  }: {
    name: string;
    scope: ActionScope;
  },
  records: TRow<S, Extract<keyof S, string>>[],
) {
  switch (scope) {
    case 'Global':
    case 'Bulk':
      return {
        action: {
          name,
          scope: scope.toLocaleLowerCase(),
        },
        records,
      };
    case 'Single':
      if (records.length !== 1) {
        throw new Error('Single actions can only be used with one selected record');
      }

      return {
        action: {
          name,
          scope: scope.toLocaleLowerCase(),
        },
        record: records[0],
      };
    default:
      throw new Error(`Unknown scope: ${scope}`);
  }
}

export default async function executeWebhook<S extends TSchema = TSchema>({
  name,
  scope,
  url,
  collection,
  context,
}: {
  name: string;
  scope: ActionScope;
  url: string;
  collection: CollectionCustomizer<S>;
  context: ActionContext<S, Extract<keyof S, string>>;
}) {
  const primaryKeys = SchemaUtils.getPrimaryKeys(collection.schema) as TFieldName<
    S,
    Extract<keyof S, string>
  >[];

  const records = await context.getRecords(primaryKeys);

  const body = generateBody({ name, scope }, records);

  await superagent.post(url).send(body);
}
