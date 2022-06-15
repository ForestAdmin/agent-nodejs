import {
  Caller,
  Collection,
  Filter,
  Page,
  PaginatedFilter,
  Projection,
  RecordUtils,
  SortFactory,
} from '@forestadmin/datasource-toolkit';
import { writeToString } from '@fast-csv/format';

export const CHUNK_SIZE = 1000;

export default class CsvGenerator {
  /**
   * Use an async generator to ensure that
   * - backpressure is properly applied without needing to extend Readable (for slow clients)
   * - we stop making queries to the database if the client closes the connection.
   */
  static async *generate(
    caller: Caller,
    projection: Projection,
    header: string,
    baseFilter: Filter,
    collection: Collection,
    list: Collection['list'],
  ): AsyncGenerator<string> {
    const sort = SortFactory.byPrimaryKeys(collection);
    const filter = new PaginatedFilter({ ...baseFilter, sort });
    let skip = 0;
    let cursor = null;

    yield writeToString([header.split(',')], { headers: true, includeEndRowDelimiter: true });

    while (true) {
      const page = filter.override({ page: new Page(skip, CHUNK_SIZE, cursor) });
      const records = await list(caller, page, projection); // eslint-disable-line no-await-in-loop
      yield writeToString(
        records.map(record => projection.map(field => RecordUtils.getFieldValue(record, field))),
      );

      // If the page is not full, we are done.
      if (records.length < CHUNK_SIZE) break;

      // Update cursor/skip for next request.
      // Note that our cursors only work on the pk
      skip += CHUNK_SIZE;
      cursor = RecordUtils.getPrimaryKey(collection.schema, records[records.length - 1]);
    }
  }
}
