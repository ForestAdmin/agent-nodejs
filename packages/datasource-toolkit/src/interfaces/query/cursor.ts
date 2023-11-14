export type PlainCursor = { cursor: string; limit: number };

export default class Cursor {
  before: string;
  after: string;
  limit: number;

  constructor(before?: string, after?: string, limit?: number) {
    this.after = after;
    this.before = before;
    this.limit = limit;
  }
}
