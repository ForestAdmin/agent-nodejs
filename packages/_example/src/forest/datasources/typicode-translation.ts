/* eslint-disable max-classes-per-file */

import { DataSourceFactory, PaginatedFilter } from '@forestadmin/datasource-toolkit';
import superagent from 'superagent';

function buildRequest(filter: PaginatedFilter) {
  let request = superagent.get(`https://jsonplaceholder.typicode.com/${this.name}s`);

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

  if (filter.page) {
    request = request.query({ _start: filter.page.skip, _limit: filter.page.limit });
  }

  if (filter.sort) {
    request = request.query({
      _sort: filter.sort.map(s => s.field.replace(':', '.')).join(','),
      _order: filter.sort.map(s => (s.ascending ? 'asc' : 'desc')).join(','),
    });
  }

  return request;
}

export default function createTypicodeTranslation(): DataSourceFactory {
  return createTranslatingDataSource(
    {
      post: {
        capabilities: { nativelySearchable: true },
        columns: {
          id: {
            type: 'Number',
            isPrimaryKey: true,
            capabilities: { filterOperators: new Set(['Equal']) },
          },
          userId: {
            type: 'Number',
            capabilities: { filterOperators: new Set(['Equal']) },
          },
          title: { type: 'String' },
          body: { type: 'String' },
        },
      },
      comment: {
        capabilities: { nativelySearchable: true },
        columns: {
          id: {
            type: 'Number',
            isPrimaryKey: true,
            capabilities: { filterOperators: new Set(['Equal']) },
          },
          postId: {
            type: 'Number',
            capabilities: { filterOperators: new Set(['Equal']) },
          },
          name: { type: 'String' },
          email: { type: 'String' },
        },
      },
    },
    {
      list: async (caller, filter, projection) => {
        const request = buildRequest(filter);
        const response = await request.send();
        this.logger('Debug', `GET ${request.url}`);

        return projection.apply(response.body);
      },

      aggregate: async (caller, filter, aggregation, limit) => {
        if (aggregation.operation === 'Count' && !aggregation.groups?.length) {
          const request = buildRequest(filter).query({ _limit: 0 });
          const response = await request.send();
          this.logger('Debug', `GET ${request.url}`);

          return [{ value: Number(response.headers['x-total-count']), group: {} }];
        }

        return aggregation.apply(
          await this.list(caller, filter, aggregation.projection),
          caller.timezone,
          limit,
        );
      },
    },
  );
}
