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
  private synched = false;

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

  private ensureSynched(): void {
    if (!this.synched) {
      throw new Error(`Collection "${this.name}" is not synched yet. Call "sync" first.`);
    }
  }

  getAction(name: string): Action {
    const actionSchema = this.schema.actions.find(action => action.name === name);

    if (actionSchema === undefined) throw new Error(`Action "${name}" not found.`);

    // TODO: Properly instanciate action.
    return null;
  }

  getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    this.ensureSynched();

    const actualId = id.length === 1 ? id[0] : id;

    return this.model
      .findByPk(actualId, { attributes: projection })
      .then(record => record.get({ plain: true }));
  }

  create(data: RecordData[]): Promise<RecordData[]> {
    this.ensureSynched();

    return this.model.bulkCreate(data);
  }

  list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    this.ensureSynched();

    void filter;
    void projection;
    throw new Error('Method not implemented.');
  }

  update(filter: Filter, patch: RecordData): Promise<void> {
    this.ensureSynched();

    void filter;
    void patch;
    throw new Error('Method not implemented.');
  }

  delete(filter: Filter): Promise<void> {
    this.ensureSynched();

    void filter;
    throw new Error('Method not implemented.');
  }

  aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]> {
    this.ensureSynched();

    void filter;
    void aggregation;
    throw new Error('Method not implemented.');
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
}
