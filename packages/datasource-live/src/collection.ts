import { DataTypes } from 'sequelize';

import {
  Action,
  AggregateResult,
  Aggregation,
  Collection,
  CollectionSchema,
  CompositeId,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

export default class LiveCollection implements Collection {
  private model = null;
  private sequelize = null;
  readonly dataSource: DataSource;
  readonly name = null;
  readonly schema: CollectionSchema = null;

  constructor(name, datasource: DataSource, schema: CollectionSchema, sequelize) {
    this.dataSource = datasource;
    this.name = name;
    this.schema = schema;
    this.sequelize = sequelize;

    // TODO: Properly call `define` with details from schema.
    this.model = this.sequelize.define(name, {
      id: {
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER,
      },
      value: {
        type: DataTypes.STRING,
      },
    });
  }

  getAction(name: string): Action {
    const actionSchema = this.schema.actions.find(action => action.name === name);

    if (actionSchema === undefined) throw new Error(`Action "${name}" not found.`);

    // TODO: Properly instanciate action.
    return null;
  }

  getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    void id;
    void projection;
    throw new Error('Method not implemented.');
  }

  create(data: RecordData[]): Promise<RecordData[]> {
    void data;
    throw new Error('Method not implemented.');
  }

  list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    void filter;
    void projection;
    throw new Error('Method not implemented.');
  }

  update(filter: Filter, patch: RecordData): Promise<void> {
    void filter;
    void patch;
    throw new Error('Method not implemented.');
  }

  delete(filter: Filter): Promise<void> {
    void filter;
    throw new Error('Method not implemented.');
  }

  aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]> {
    void filter;
    void aggregation;
    throw new Error('Method not implemented.');
  }
}
