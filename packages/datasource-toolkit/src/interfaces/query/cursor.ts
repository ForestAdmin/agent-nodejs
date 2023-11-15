export type PlainCursor = { limit: number; cursor: { before?: string; after?: string } };

export default class Cursor {
  before: string;
  after: string;
  limit: number;

  constructor(limit: number, cursor: { before?: string; after?: string }) {
    this.after = cursor.after || null;
    this.before = cursor.before || null;
    this.limit = limit;

    if (this.after && this.before)
      throw new Error(`Cursor can't have before and after at same time.`);
  }
}
