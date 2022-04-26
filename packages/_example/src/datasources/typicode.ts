/* eslint-disable max-classes-per-file */

import {
  AggregateResult,
  Aggregation,
  BaseCollection,
  BaseDataSource,
  Caller,
  Filter,
  Logger,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import superagent from 'superagent';

class TypicodeCollection extends BaseCollection {
  logger: Logger;

  constructor(name: string, logger: Logger) {
    super(name, null);

    this.logger = logger;
    this.enableSearch();
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    let request = this.buildRequest(filter);

    if (filter.page) {
      request = request.query({ _start: filter.page.skip, _limit: filter.page.limit });
    }

    if (filter.sort) {
      request = request.query({
        _sort: filter.sort.map(s => s.field.replace(':', '.')).join(','),
        _order: filter.sort.map(s => (s.ascending ? 'asc' : 'desc')).join(','),
      });
    }

    const response = await request.send();
    this.logger('Debug', `GET ${request.url}`);

    return projection.apply(response.body);
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit: number,
  ): Promise<AggregateResult[]> {
    if (aggregation.operation === 'Count' && !aggregation.groups?.length) {
      const request = this.buildRequest(filter).query({ _limit: 0 });
      const response = await request.send();
      this.logger('Debug', `GET ${request.url}`);

      return [{ value: Number(response.headers['x-total-count']), group: {} }];
    }

    return aggregation.apply(
      await this.list(caller, filter, aggregation.projection),
      caller.timezone,
      limit,
    );
  }

  create(): Promise<RecordData[]> {
    throw new Error('Method not implemented.');
  }

  update(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  delete(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private buildRequest(filter: Filter) {
    let request = superagent.get(`https://jsonplaceholder.typicode.com/${this.name}`);

    if (filter.conditionTree) {
      // Warning: this implementation ignores Or/And
      // It assumes that leafs targeting the same field are "or", and leaf targeting different
      // fields are "and", which is good enough for the same of example.
      const query = {};

      filter.conditionTree.forEachLeaf(({ field, value }) => {
        if (query[field] && Array.isArray(query[field])) query[field].push(value);
        else if (query[field]) query[field] = [query[field], value];
        else query[field] = value;
      });

      request = request.query(query);
    }

    if (filter.search) {
      request = request.query({ q: filter.search });
    }

    return request;
  }
}

class Posts extends TypicodeCollection {
  constructor(logger: Logger) {
    super('posts', logger);

    this.addField('id', {
      isPrimaryKey: true,
      type: 'Column',
      columnType: 'Number',
      filterOperators: new Set(['Equal']),
    });

    this.addField('userId', { type: 'Column', columnType: 'Number' });
    this.addField('title', { type: 'Column', columnType: 'String' });
    this.addField('body', { type: 'Column', columnType: 'String' });
  }
}

class Comments extends TypicodeCollection {
  constructor(logger: Logger) {
    super('comments', logger);

    this.addField('id', {
      isPrimaryKey: true,
      type: 'Column',
      columnType: 'Number',
      filterOperators: new Set(['Equal']),
    });

    this.addField('postId', {
      type: 'Column',
      columnType: 'Number',
      filterOperators: new Set(['Equal']),
    });

    this.addField('name', { type: 'Column', columnType: 'String' });
    this.addField('email', { type: 'Column', columnType: 'String' });
    this.addField('body', { type: 'Column', columnType: 'String' });
  }
}

export default () => {
  return async (logger: Logger) => {
    const dataSource = new BaseDataSource();
    dataSource.addCollection(new Posts(logger));
    dataSource.addCollection(new Comments(logger));

    return dataSource;
  };
};
