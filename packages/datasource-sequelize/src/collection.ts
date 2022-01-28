import { fn, ModelDefined, Sequelize } from 'sequelize';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected model: ModelDefined<any, any> = null;
  protected sequelize: Sequelize = null;

  constructor(name: string, datasource: DataSource, sequelize: Sequelize) {
    super(name, datasource);

    this.sequelize = sequelize;
    this.model = sequelize?.models?.[name];

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
      .then(record => record && record.get({ plain: true }));
  }

  create(data: RecordData[]): Promise<RecordData[]> {
    return this.model
      .bulkCreate(data)
      .then(records => records.map(record => record.get({ plain: true })));
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

  async aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]> {
    const operation = aggregation.operation.toUpperCase();
    const field = aggregation.field ?? '*';
    const aggregateFieldName = '__aggregate__';

    const attributes: (string | (ReturnType<typeof fn> | string)[])[] = [
      [this.sequelize.fn(operation, this.sequelize.col(field)), aggregateFieldName],
    ];

    if (aggregation.field) attributes.push(field);

    const aggregates = await this.model.findAll({
      ...convertPaginatedFilterToSequelize(filter),
      attributes,
      group: aggregation.field,
    });

    return aggregates.map(aggregate => ({
      value: aggregate.get(aggregateFieldName) as number,
      group: { [aggregation.field ? `${aggregate.get(field)}` : field]: null },
    }));
  }
}
