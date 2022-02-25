import {
  Collection,
  Filter,
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
    filter: Filter,
    collection: Collection,
    list: (paginatedFilter: PaginatedFilter, Projection: Projection) => Promise<RecordData[]>,
  ): AsyncGenerator<string> {
    yield `${header}\n`;
    let skip = 0;
    let isAllRecordFetched = false;

    while (!isAllRecordFetched) {
      const page = new Page(skip, PAGE_SIZE);
      const sort = SortFactory.byPrimaryKeys(collection);
      const paginatedFilter = new PaginatedFilter({ page, sort }).override({ ...filter });

      // eslint-disable-next-line no-await-in-loop
      const records = await list(paginatedFilter, projection);

      yield CsvGenerator.convert(records, projection);

      isAllRecordFetched = records.length < PAGE_SIZE;
      skip += PAGE_SIZE;
    }
  }

  private static convert(records: RecordData[], projection: Projection): string {
    return records.map(record => CsvGenerator.buildLine(projection, record)).join('');
  }

  private static buildLine(projection: Projection, record: RecordData) {
    return `${projection
      .map(field => {
        let value = String(RecordUtils.getFieldValue(record, field));
        if (value.includes(',')) value = `"${value.replace('"', '""')}"`;

        return value;
      })
      .join(',')}\n`;
  }
}
