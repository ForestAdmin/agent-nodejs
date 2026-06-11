import type {
  Caller,
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
    const ids = this.extractIdLookup(filter?.conditionTree);

    if (ids) {
      const raw = await this.fetchRecordsByIds(ids);
      const records = raw.map(record => this.serializeRecord(record));

      return projection.apply(this.refine(records, filter, caller.timezone));
    }

    const raw = await this.searchRecords(filter);

    return projection.apply(raw.map(record => this.serializeRecord(record)));
  }
}
