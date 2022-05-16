import { TCollectionName, TSchema } from '../../templates';
import Filter, { FilterComponents, PlainFilter } from './unpaginated';
import Page, { PlainPage } from '../page';
import Sort, { PlainSortClause } from '../sort';

export type PaginatedFilterComponents = FilterComponents & {
  sort?: Sort;
  page?: Page;
};

export type PlainPaginatedFilter<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = PlainFilter<S, N> & {
  sort?: Array<PlainSortClause<S, N>>;
  page?: PlainPage;
};

export default class PaginatedFilter extends Filter {
  sort?: Sort;
  page?: Page;

  constructor(parts: PaginatedFilterComponents) {
    super(parts);
    this.sort = parts.sort;
    this.page = parts.page;
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
