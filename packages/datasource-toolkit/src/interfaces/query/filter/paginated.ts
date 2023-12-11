import Filter, { FilterComponents, PlainFilter } from './unpaginated';
import Cursor, { PlainCursor } from '../cursor';
import Page, { PlainPage } from '../page';
import Sort, { PlainSortClause } from '../sort';

export type PaginationType = 'page' | 'cursor';

export type PaginatedFilterComponents = FilterComponents & {
  sort?: Sort;
  page?: Page;
  cursor?: Cursor;
};

export type PlainPaginatedFilter = PlainFilter & {
  sort?: Array<PlainSortClause>;
  page?: PlainPage;
  cursor?: PlainCursor;
};

export default class PaginatedFilter extends Filter {
  sort?: Sort;
  page?: Page;
  cursor?: Cursor;

  constructor(parts: PaginatedFilterComponents) {
    super(parts);
    this.sort = parts.sort;
    this.page = parts.page;
    this.cursor = parts.cursor;
  }

  override override(fields: PaginatedFilterComponents): PaginatedFilter {
    return new PaginatedFilter({ ...this, ...fields });
  }

  override nest(prefix: string): PaginatedFilter {
    if (!this.isNestable) throw new Error("Filter can't be nested");

    return this.override({
      conditionTree: this.conditionTree?.nest(prefix),
      sort: this.sort?.nest(prefix),
    });
  }
}
