import type {
  AggregateResult,
  Aggregation,
  Caller,
  ConditionTree,
  DataSource,
  DataSourceFactory,
  Filter,
  Logger,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import { BaseCollection, BaseDataSource } from '@forestadmin/datasource-toolkit';
import superagent from 'superagent';

import { demoFields } from '../../connections/data-model';
import { MERCHANTS_PATH } from '../../merchants-api';

const EQUALITY_OPERATORS = new Set(['Equal', 'In'] as const);

function equalityQuery(conditionTree: ConditionTree): Record<string, unknown[]> {
  const query: Record<string, unknown[]> = {};

  conditionTree.forEachLeaf(({ field, value }) => {
    query[field] = [...(query[field] ?? []), ...[value].flat()];
  });

  return query;
}

class CardMerchants extends BaseCollection {
  constructor(private readonly baseUrl: string, private readonly logger: Logger) {
    super(MERCHANTS_PATH, null);

    this.enableCount();
    this.enableSearch();

    this.addField('id', {
      type: 'Column',
      columnType: 'String',
      isPrimaryKey: true,
      isSortable: true,
      filterOperators: EQUALITY_OPERATORS,
    });
    this.addField('counterparty_id', {
      type: 'Column',
      columnType: 'String',
      filterOperators: EQUALITY_OPERATORS,
    });
    this.addField('name', { type: 'Column', columnType: 'String', isSortable: true });
    this.addField('category', {
      type: 'Column',
      columnType: 'Enum',
      enumValues: demoFields('card_merchants').find(field => field.name === 'category').enum,
      isSortable: true,
      filterOperators: EQUALITY_OPERATORS,
    });
    this.addField('mcc_code', {
      type: 'Column',
      columnType: 'String',
      filterOperators: EQUALITY_OPERATORS,
    });
    this.addField('city', {
      type: 'Column',
      columnType: 'String',
      isSortable: true,
      filterOperators: EQUALITY_OPERATORS,
    });
    this.addField('acquirer', { type: 'Column', columnType: 'String', isSortable: true });
    this.addField('acquirer_merchant_id', { type: 'Column', columnType: 'String' });
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
        _sort: filter.sort.map(s => s.field).join(','),
        _order: filter.sort.map(s => (s.ascending ? 'asc' : 'desc')).join(','),
      });
    }

    const response = await request;
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
      const response = await request;
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
    throw new Error('The merchants API is read-only');
  }

  update(): Promise<void> {
    throw new Error('The merchants API is read-only');
  }

  delete(): Promise<void> {
    throw new Error('The merchants API is read-only');
  }

  private buildRequest(filter: Filter) {
    let request = superagent.get(`${this.baseUrl}/${MERCHANTS_PATH}`);

    if (filter.conditionTree) request = request.query(equalityQuery(filter.conditionTree));
    if (filter.search) request = request.query({ q: filter.search });

    return request;
  }
}

export default function createCardMerchants(baseUrl: string): DataSourceFactory {
  return async (logger: Logger): Promise<DataSource> => {
    const dataSource = new BaseDataSource();
    dataSource.addCollection(new CardMerchants(baseUrl, logger));

    return dataSource;
  };
}
