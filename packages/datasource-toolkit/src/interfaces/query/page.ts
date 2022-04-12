import { RecordData } from '../record';

export type PlainPage = { skip: number; limit: number };

export default class Page {
  skip: number;
  limit: number;

  constructor(skip?: number, limit?: number) {
    this.skip = skip ?? 0;
    this.limit = limit ?? null;
  }

  apply(records: RecordData[]): RecordData[] {
    const end = this.limit ? this.skip + this.limit : undefined;

    return records.slice(this.skip, end);
  }
}
