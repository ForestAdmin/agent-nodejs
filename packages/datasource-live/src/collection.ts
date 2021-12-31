import { DataTypes } from 'sequelize';

import {
  AggregateResult,
  Aggregation,
  CollectionSchema,
  CompositeId,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { SequelizeCollection } from '@forestadmin/datasource-sequelize';

export default class LiveCollection extends SequelizeCollection {
  private synched = false;

  constructor(name, datasource: DataSource, schema: CollectionSchema, sequelize) {
    super(name, datasource, schema, sequelize);

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

  private ensureSynched(): void {
    if (!this.synched) {
      throw new Error(`Collection "${this.name}" is not synched yet. Call "sync" first.`);
    }
  }

  async sync(): Promise<boolean> {
    this.synched = false;

    return this.model
      .sync({ force: true })
      .then(() => {
        this.synched = true;
      })
      .then(() => true);
  }

  override getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    this.ensureSynched();

    return super.getById(id, projection);
  }

  override create(data: RecordData[]): Promise<RecordData[]> {
    this.ensureSynched();

    return super.create(data);
  }

  override list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    this.ensureSynched();

    return super.list(filter, projection);
  }

  override update(filter: Filter, patch: RecordData): Promise<void> {
    this.ensureSynched();

    return super.update(filter, patch);
  }

  override delete(filter: Filter): Promise<void> {
    this.ensureSynched();

    return super.delete(filter);
  }

  override aggregate(
    filter: PaginatedFilter,
    aggregation: Aggregation,
  ): Promise<AggregateResult[]> {
    this.ensureSynched();

    return super.aggregate(filter, aggregation);
  }
}
