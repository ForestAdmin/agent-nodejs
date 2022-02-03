import { Sequelize } from 'sequelize';

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

import CollectionSchemaConverter from './utils/collection-schema-to-model-attributes-converter';

export default class LiveCollection extends SequelizeCollection {
  private synched = false;

  constructor(name: string, dataSource: DataSource, sequelize: Sequelize, schema?: CollectionSchema) {
    super(
      name,
      dataSource,
      // Make Sequelize believe model was previously defined to use it in Collection.
      // Only if not defined previously at DataSource level.
      (sequelize.models[name] ||
        (schema && sequelize.define(name, CollectionSchemaConverter.convert(schema)))) &&
        sequelize,
    );

    if (schema?.searchable) this.enableSearch();
  }

  private ensureSynched(): void {
    if (!this.synched) {
      throw new Error(`Collection "${this.name}" is not synched yet. Call "sync" first.`);
    }
  }

  async sync(): Promise<boolean> {
    this.synched = false;

    await this.model.sync({ force: true });
    this.synched = true;

    return true;
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
