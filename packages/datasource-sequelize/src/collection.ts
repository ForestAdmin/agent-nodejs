import {
  AggregateResult,
  Aggregation,
  BaseCollection,
  CompositeId,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import ModelConverter from './utils/model-to-collection-schema-converter';

import { convertPaginatedFilterToSequelize } from './utils/filter-converter';

export default class SequelizeCollection extends BaseCollection {
  protected model = null;
  protected sequelize = null;

  constructor(name, datasource: DataSource, sequelize) {
    super(name, datasource);

    this.sequelize = sequelize;
    this.model = sequelize?.[name];

    if (!sequelize) throw new Error('Invalid (null) Sequelize instance.');
    if (!this.model) throw new Error(`Could not get model for "${name}".`);

    const modelSchema = ModelConverter.convert(this.model);

    this.addFields(modelSchema.fields);
    this.addSegments(modelSchema.segments);
  }

  getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    const actualId = {};

    SchemaUtils.getPrimaryKeys(this.schema).forEach((field, index) => {
      actualId[field] = id[index];
    });

    return this.model
      .findOne({
        where: actualId,
        attributes: projection,
      })
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
    const operation = aggregation.operation.toUpperCase();
    const field = aggregation.field ?? '*';
    const aggregateFieldName = '__aggregate__';

    const attributes: [string | string[]] = [
      [this.sequelize.fn(operation, this.sequelize.col(field)), aggregateFieldName],
    ];

    if (aggregation.field) attributes.push(field);

    return this.model
      .findAll({
        ...convertPaginatedFilterToSequelize(filter),
        attributes,
        group: aggregation.field,
      })
      .then(aggregates =>
        aggregates.map(aggregate => ({
          value: aggregate.get(aggregateFieldName),
          group: aggregation.field ? `${aggregate.get(field)}` : field,
        })),
      );
  }
}
