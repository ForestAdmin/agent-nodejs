import { RecordData } from '../record';

export const constants = {
  QUERY_PAGE_DEFAULT_LIMIT: 15,
  QUERY_PAGE_DEFAULT_SKIP: 0,
};

export default class Page {
  skip: number;
  limit: number;

  constructor(skip?: number, limit?: number) {
    this.skip = skip ?? constants.QUERY_PAGE_DEFAULT_SKIP;
    this.limit = limit ?? constants.QUERY_PAGE_DEFAULT_LIMIT;
  }

  apply(records: RecordData[]): RecordData[] {
    const end = this.limit ? this.skip + this.limit : undefined;

    return records.slice(this.skip, end);
  }
}
