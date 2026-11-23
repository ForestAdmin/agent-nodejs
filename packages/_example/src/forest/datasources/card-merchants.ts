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

import {
  BaseCollection,
  BaseDataSource,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  ForbiddenError,
} from '@forestadmin/datasource-toolkit';
import superagent from 'superagent';

import { demoFields } from '../../connections/data-model';
import { MERCHANTS_PATH } from '../../merchants-api';

const EQUALITY_OPERATORS = new Set(['Equal', 'In'] as const);
const READ_ONLY = 'The merchants API is read-only';

function apiLeaves(conditionTree: ConditionTree): ConditionTreeLeaf[] | null {
  if (conditionTree instanceof ConditionTreeLeaf) return [conditionTree];

  if (!(conditionTree instanceof ConditionTreeBranch) || conditionTree.aggregator !== 'And') {
    return null;
  }

  const leaves = conditionTree.conditions.filter(
    (condition): condition is ConditionTreeLeaf => condition instanceof ConditionTreeLeaf,
  );
  const fields = new Set(leaves.map(leaf => leaf.field));

  return leaves.length === conditionTree.conditions.length && fields.size === leaves.length
    ? leaves
    : null;
}

function equalityQuery(conditionTree: ConditionTree | undefined): Record<string, unknown[]> | null {
  if (!conditionTree) return {};

  const leaves = apiLeaves(conditionTree);
  if (!leaves) return null;

  const query = Object.fromEntries(leaves.map(({ field, value }) => [field, [value].flat()]));

  return Object.values(query).some(values => !values.length) ? null : query;
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
    const query = equalityQuery(filter.conditionTree);

    if (!query) {
      let records = await this.filterInProcess(caller, filter);
      if (filter.sort) records = filter.sort.apply(records);
      if (filter.page) records = filter.page.apply(records);

      return projection.apply(records);
    }

    let request = this.buildRequest(filter, query);

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
    const query = equalityQuery(filter.conditionTree);

    if (aggregation.operation === 'Count' && !aggregation.groups?.length) {
      if (!query) {
        return [{ value: (await this.filterInProcess(caller, filter)).length, group: {} }];
      }

      const request = this.buildRequest(filter, query).query({ _limit: 0 });
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
    throw new ForbiddenError(READ_ONLY);
  }

  update(): Promise<void> {
    throw new ForbiddenError(READ_ONLY);
  }

  delete(): Promise<void> {
    throw new ForbiddenError(READ_ONLY);
  }

  private async filterInProcess(caller: Caller, filter: Filter): Promise<RecordData[]> {
    const request = this.buildRequest(filter, {});
    const response = await request;
    this.logger('Debug', `GET ${request.url}`);

    return filter.conditionTree.apply(response.body, this, caller.timezone);
  }

  private buildRequest(filter: Filter, query: Record<string, unknown[]>) {
    let request = superagent.get(`${this.baseUrl}/${MERCHANTS_PATH}`).query(query);

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
