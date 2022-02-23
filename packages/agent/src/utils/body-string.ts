import { CollectionSchema } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import { SelectionIds } from '../types';
import IdUtils from './id';

export default class BodyStringParser {
  static parseSelectionIds(schema: CollectionSchema, context: Context): SelectionIds {
    const data = context.request.body?.data;
    const attributes = data?.attributes;
    const areExcluded = Boolean(attributes?.all_records);
    let ids = attributes?.ids || (Array.isArray(data) && data.map(r => r.id)) || undefined;
    ids = IdUtils.unpackIds(schema, areExcluded ? attributes?.all_records_ids_excluded : ids);

    return { areExcluded, ids };
  }
}
