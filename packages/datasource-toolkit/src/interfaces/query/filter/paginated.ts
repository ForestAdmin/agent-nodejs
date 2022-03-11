import Filter, { FilterComponents } from './unpaginated';
import Page from '../page';
import Sort from '../sort';

export type PaginatedFilterComponents = FilterComponents & {
  sort?: Sort;
  page?: Page;
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
