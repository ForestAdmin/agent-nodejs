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

import { convertPaginatedFilterToSequelize } from './utils/filterConverter';

export default class SequelizeCollection implements Collection {
  protected model = null;
  protected sequelize = null;

  readonly dataSource: DataSource;
  readonly name = null;
  readonly schema: CollectionSchema = null;

  constructor(name, datasource: DataSource, schema: CollectionSchema, sequelize) {
    this.dataSource = datasource;
    this.name = name;
    this.schema = schema;
    this.sequelize = sequelize;
  }

  getAction(name: string): Action {
    const actionSchema = this.schema.actions.find(action => action.name === name);

    if (actionSchema === undefined) throw new Error(`Action "${name}" not found.`);

    // TODO: Properly instanciate action.
    return null;
  }

  getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    const actualId = id.length === 1 ? id[0] : id;

    return this.model
      .findByPk(actualId, { attributes: projection })
      .then(record => record.get({ plain: true }));
  }

  create(data: RecordData[]): Promise<RecordData[]> {
    return this.model.bulkCreate(data);
  }

  list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    return this.model
      .findAll({
        ...convertPaginatedFilterToSequelize(filter),
        attributes: projection,
      })
      .then(records => records.map(record => record.get({ plain: true })));
  }

  update(filter: Filter, patch: RecordData): Promise<void> {
    return this.model
      .update(patch, {
        ...convertPaginatedFilterToSequelize(filter),
        fields: Object.keys(patch),
      })
      .then(() => null);
  }

  delete(filter: Filter): Promise<void> {
    return this.model.destroy({ ...convertPaginatedFilterToSequelize(filter) }).then(() => null);
  }

  aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]> {
    void filter;
    void aggregation;
    throw new Error('Method not implemented.');
  }
}
