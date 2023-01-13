import { CollectionSchema } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import IdUtils from './id';
import { SelectionIds } from '../types';

export default class BodyParser {
  static parseSelectionIds(schema: CollectionSchema, context: Context): SelectionIds {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = context.request.body as any;
    const data = body?.data;
    const attributes = data?.attributes;
    const areExcluded = Boolean(attributes?.all_records);
    let ids = attributes?.ids || (Array.isArray(data) && data.map(r => r.id)) || undefined;
    ids = IdUtils.unpackIds(schema, areExcluded ? attributes?.all_records_ids_excluded : ids);

    return { areExcluded, ids };
  }
}
