import type { Caller, Collection, Projection, RecordData } from '@forestadmin/datasource-toolkit';

import { writeToString } from '@fast-csv/format';
import { Page, PaginatedFilter, RecordUtils, SortFactory } from '@forestadmin/datasource-toolkit';

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
    limitExportSize: number,
    collection: Collection,
    list: Collection['list'],
  ): AsyncGenerator<string> {
    yield writeToString([header.split(',')], { headers: true, includeEndRowDelimiter: true });

    const copiedFilter = { ...filter };

    if (!copiedFilter.sort || copiedFilter.sort.length === 0) {
      copiedFilter.sort = SortFactory.byPrimaryKeys(collection);
    }

    let currentIndex = 0;
    let pageLimit = limitExportSize != null ? Math.min(limitExportSize, CHUNK_SIZE) : CHUNK_SIZE;
    let areAllRecordsFetched = false;

    while (!areAllRecordsFetched) {
      // the first argument is included in the range, the second is excluded
      copiedFilter.page = new Page(currentIndex, pageLimit);

      // eslint-disable-next-line no-await-in-loop
      const records = await list(caller, new PaginatedFilter(copiedFilter), projection);

      if (records.length !== 0) yield CsvGenerator.convert(records, projection);

      currentIndex += pageLimit;
      areAllRecordsFetched = records.length < CHUNK_SIZE || limitExportSize === currentIndex;

      if (limitExportSize) {
        pageLimit = Math.min(CHUNK_SIZE, limitExportSize - currentIndex);
      } else {
        pageLimit = CHUNK_SIZE;
      }
    }
  }

  private static convert(records: RecordData[], projection: Projection): Promise<string> {
    return writeToString(
      records.map(record =>
        projection.map(field => {
          const value = RecordUtils.getFieldValue(record, field);

          if (value?.toString() === '[object Object]') {
            return JSON.stringify(value);
          }

          return value;
        }),
      ),
      { includeEndRowDelimiter: true },
    );
  }
}
