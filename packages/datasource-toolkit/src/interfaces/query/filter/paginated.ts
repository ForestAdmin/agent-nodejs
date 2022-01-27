import { RecordData } from '../../record';
import Page from '../page';
import Sort from '../sort';
import Filter, { FilterComponents } from './unpaginated';

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

  override apply(records: RecordData[]): RecordData[] {
    let result = super.apply(records);
    if (this.sort) result = this.sort.apply(records);
    if (this.page) result = this.page.apply(records);

    return result;
  }

  override override(fields: PaginatedFilterComponents): PaginatedFilter {
    return new PaginatedFilter({ ...this, ...fields });
  }
}
