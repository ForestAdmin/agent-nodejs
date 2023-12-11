export type PlainCursor = { limit: number; cursor: { before?: string; after?: string } };

export default class Cursor {
  cursor: string;
  backward: boolean;
  limit: number;

  constructor(limit: number, cursor?: string, backward?: boolean) {
    this.limit = limit;
    this.cursor = cursor || null;
    this.backward = backward ?? false;
  }
}
