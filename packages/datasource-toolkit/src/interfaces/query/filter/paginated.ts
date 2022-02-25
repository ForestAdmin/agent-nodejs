import Filter, { FilterComponents } from './unpaginated';
import Page from '../page';
import Sort from '../sort/sort';

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
}
