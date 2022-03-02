import {
  Collection,
  Page,
  PaginatedFilter,
  Projection,
  RecordData,
  RecordUtils,
  SortFactory,
} from '@forestadmin/datasource-toolkit';

export const PAGE_SIZE = 1000;

export default class CsvGenerator {
  /**
   * Use an async generator to ensure that
   * - backpressure is properly applied without needing to extend Readable (for slow clients)
   * - we stop making queries to the database if the client closes the connection.
   */
  static async *generate(
    projection: Projection,
    header: string,
    filter: PaginatedFilter,
    collection: Collection,
    list: (paginatedFilter: PaginatedFilter, Projection: Projection) => Promise<RecordData[]>,
  ): AsyncGenerator<string> {
    yield `${header}\n`;

    const limit = filter.page?.limit;
    let skip = filter.page?.skip || 0;

    let areAllRecordsFetched = false;

    while (!areAllRecordsFetched) {
      let currentPageSize = PAGE_SIZE;
      if (limit < skip) currentPageSize = skip - limit;

      filter.page = new Page(skip, currentPageSize);

      if (!filter.sort || filter.sort.length === 0) {
        filter.sort = SortFactory.byPrimaryKeys(collection);
      }

      // eslint-disable-next-line no-await-in-loop
      const records = await list(new PaginatedFilter(filter), projection);

      yield CsvGenerator.convert(records, projection);

      areAllRecordsFetched = records.length < PAGE_SIZE;
      skip += currentPageSize;
    }
  }

  private static convert(records: RecordData[], projection: Projection): string {
    return records.map(record => CsvGenerator.buildLine(record, projection)).join('');
  }

  private static buildLine(record: RecordData, projection: Projection) {
    return `${projection
      .map(field => {
        let value = String(RecordUtils.getFieldValue(record, field));
        if (value.includes(',')) value = `"${value.replace('"', '""')}"`;

        return value;
      })
      .join(',')}\n`;
  }
}
