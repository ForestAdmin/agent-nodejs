import {
  ActionField,
  ActionResult,
  AggregateResult,
  Aggregation,
  Caller,
  Collection,
  CollectionSchema,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import { QueryFn } from './types';
import RpcDataSource from './datasource';

export default class RpcCollection implements Collection {
  readonly schema: CollectionSchema;
  readonly name: string;
  readonly dataSource: RpcDataSource;
  readonly queryFn: QueryFn;

  constructor(name: string, dataSource: RpcDataSource, queryFn: QueryFn, schema: CollectionSchema) {
    this.schema = schema;
    this.name = name;
    this.dataSource = dataSource;
    this.queryFn = data => queryFn({ collection: this.name, ...data });
  }

  async execute(
    caller: Caller,
    name: string,
    formValues: RecordData,
    filter?: Filter,
  ): Promise<ActionResult> {
    return this.queryFn({ method: 'execute', params: { caller, name, formValues, filter } });
  }

  async getForm(
    caller: Caller,
    name: string,
    formValues?: RecordData,
    filter?: Filter,
  ): Promise<ActionField[]> {
    return this.queryFn({ method: 'getForm', params: { caller, name, formValues, filter } });
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    return this.queryFn({ method: 'create', params: { caller, data } });
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    return this.queryFn({ method: 'list', params: { caller, filter, projection } });
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    await this.queryFn({ method: 'update', params: { caller, filter, patch } });
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    await this.queryFn({ method: 'delete', params: { caller, filter } });
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    return this.queryFn({ method: 'aggregate', params: { caller, filter, aggregation, limit } });
  }
}
