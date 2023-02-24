import {
  Collection,
  Page,
  PaginatedFilter,
  Sort,
  SortFactory,
  SortValidator,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import FilterParser from './abstract';

export default class ListFilterParser extends FilterParser {
  static fromCtx(collection: Collection, context: Context): PaginatedFilter {
    return new PaginatedFilter({
      conditionTree: this.parseUserFilter(collection, context),
      search: this.parseSearch(collection, context),
      searchExtended: this.parseSearchExtended(context),
      segment: this.parseSegment(collection, context),
      page: this.parsePagination(context),
      sort: this.parseSort(collection, context),
    });
  }

  protected static parsePagination(context: Context): Page {
    const queryPageSize = this.getValue(context, 'page[size]', '15');
    const queryPageNumber = this.getValue(context, 'page[number]', '1');
    const pageSize = Number.parseInt(queryPageSize, 10);
    const pageNumber = Number.parseInt(queryPageNumber, 10);

    if (Number.isNaN(pageSize) || Number.isNaN(pageNumber) || pageSize <= 0 || pageNumber <= 0) {
      throw new ValidationError(`Invalid pagination [limit: ${pageSize}, skip: ${pageNumber}]`);
    }

    return new Page((pageNumber - 1) * pageSize, pageSize);
  }

  protected static parseSort(collection: Collection, context: Context): Sort {
    const sortString = this.getValue(context, 'sort');

    try {
      if (!sortString) return SortFactory.byPrimaryKeys(collection);

      const sort = new Sort({
        field: sortString.replace(/^-/, '').replace('.', ':'),
        ascending: !sortString.startsWith('-'),
      });

      SortValidator.validate(collection, sort);

      return sort;
    } catch {
      throw new ValidationError(`Invalid sort: ${sortString}`);
    }
  }
}
