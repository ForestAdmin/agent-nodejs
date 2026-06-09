import type { ZendeskRecord } from '../types';
import type {
  Caller,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import BaseZendeskCollection from './base-zendesk-collection';

export default abstract class SearchableCollection extends BaseZendeskCollection {
  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const rawRecords = await this.fetchRawRecords(filter);
    const records = rawRecords.map(raw => this.serializeRecord(raw));

    return projection.apply(records);
  }

  protected override async aggregateCount(caller: Caller, filter: Filter): Promise<number> {
    const ids = this.extractIdLookup(filter?.conditionTree);

    if (ids) {
      const records = await Promise.all(ids.map(id => this.findOne(id)));

      return records.filter(Boolean).length;
    }

    return this.client.count(this.resource, this.buildZendeskQuery(filter));
  }

  protected async resolveIds(filter: Filter): Promise<number[]> {
    const direct = this.extractIdLookup(filter?.conditionTree);
    if (direct) return direct;

    const records = await this.client.search(this.resource, {
      query: this.buildZendeskQuery(filter),
      perPage: 100,
    });

    return records.map(record => Number(record.id)).filter(id => Number.isFinite(id));
  }

  protected async fetchRawRecords(filter: PaginatedFilter): Promise<ZendeskRecord[]> {
    const ids = this.extractIdLookup(filter?.conditionTree);

    if (ids) {
      const results = await Promise.all(ids.map(id => this.findOne(id)));

      return results.filter((record): record is ZendeskRecord => record !== null);
    }

    const { page, perPage } = this.translatePage(filter?.page);
    const { sortBy, sortOrder } = this.translateSort(filter?.sort);

    return this.client.search(this.resource, {
      query: this.buildZendeskQuery(filter),
      page,
      perPage,
      sortBy,
      sortOrder,
    });
  }

  protected abstract findOne(id: number | string): Promise<ZendeskRecord | null>;

  protected abstract serializeRecord(record: ZendeskRecord): RecordData;
}
