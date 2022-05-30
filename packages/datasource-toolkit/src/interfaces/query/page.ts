import { CompositeId, RecordData } from '../record';

export type PlainPage = {
  skip: number;
  limit: number;
  cursor: CompositeId;
};

export default class Page {
  skip: number;
  limit: number;
  cursor: CompositeId;

  constructor(skip?: number, limit?: number, cursor?: CompositeId) {
    this.skip = skip ?? 0;
    this.limit = limit ?? null;
    this.cursor = cursor ?? null;
  }

  apply(records: RecordData[]): RecordData[] {
    const end = this.limit ? this.skip + this.limit : undefined;

    return records.slice(this.skip, end);
  }
}
