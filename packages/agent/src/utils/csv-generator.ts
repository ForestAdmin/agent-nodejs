import {
  Caller,
  Collection,
  Page,
  PaginatedFilter,
  Projection,
  RecordData,
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
    filter: PaginatedFilter,
    collection: Collection,
    list: Collection['list'],
  ): AsyncGenerator<string> {
    yield writeToString([header.split(',')], { headers: true, includeEndRowDelimiter: true });

    const limit = filter.page?.limit;
    let skip = filter.page?.skip || 0;

    let areAllRecordsFetched = false;
    const copiedFilter = { ...filter };

    while (!areAllRecordsFetched) {
      let currentPageSize = CHUNK_SIZE;
      if (limit < skip) currentPageSize = skip - limit;

      copiedFilter.page = new Page(skip, currentPageSize);

      if (!copiedFilter.sort || copiedFilter.sort.length === 0) {
        copiedFilter.sort = SortFactory.byPrimaryKeys(collection);
      }

      // eslint-disable-next-line no-await-in-loop
      const records = await list(caller, new PaginatedFilter(copiedFilter), projection);

      yield CsvGenerator.convert(records, projection);

      areAllRecordsFetched = records.length < CHUNK_SIZE;
      skip += currentPageSize;
    }
  }

  private static convert(records: RecordData[], projection: Projection): Promise<string> {
    return writeToString(
      records.map(record => projection.map(field => RecordUtils.getFieldValue(record, field))),
    );
  }
}
