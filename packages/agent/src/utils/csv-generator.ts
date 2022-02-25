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
    let isAllRecordsFetched = false;

    while (!isAllRecordsFetched) {
      const page = new Page(skip, PAGE_SIZE);
      const sort = SortFactory.byPrimaryKeys(collection);
      const paginatedFilter = new PaginatedFilter({ page, sort }).override({ ...filter });

      // eslint-disable-next-line no-await-in-loop
      const records = await list(paginatedFilter, projection);

      yield CsvGenerator.convert(records);

      isAllRecordsFetched = records.length < PAGE_SIZE;
      skip += PAGE_SIZE;
    }
  }

  private static convert(records: RecordData[]): string {
    return records.map(record => CsvGenerator.buildLine(record)).join('');
  }

  private static buildLine(record: RecordData) {
    return `${Object.keys(record)
      .map(field => {
        let value = String(RecordUtils.getFieldValue(record, field));
        if (value.includes(',')) value = `"${value.replace('"', '""')}"`;

        return value;
      })
      .join(',')}\n`;
  }
}
