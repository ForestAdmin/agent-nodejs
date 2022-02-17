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
import {
  col as Col,
  FindAttributeOptions,
  fn as Fn,
  GroupOption,
  ModelDefined,
  OrderItem,
  UpdateOptions,
} from 'sequelize';

import ModelConverter from './utils/model-to-collection-schema-converter';
import QueryConverter from './utils/query-converter';

export default class SequelizeCollection extends BaseCollection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected model: ModelDefined<any, any> = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(name: string, datasource: DataSource, model: ModelDefined<any, any>) {
    super(name, datasource);

    if (!model) throw new Error('Invalid (null) model instance.');

    this.model = model;

    const modelSchema = ModelConverter.convert(this.model);

    this.addFields(modelSchema.fields);
    this.addSegments(modelSchema.segments);
  }

  override async getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    const actualId = {};

    SchemaUtils.getPrimaryKeys(this.schema).forEach((field, index) => {
      actualId[field] = id[index];
    });

    const record = await this.model.findOne({
      where: actualId,
      ...QueryConverter.convertProjectionToSequelize(projection),
    });

    return record && record.get({ plain: true });
  }

  async create(data: RecordData[]): Promise<RecordData[]> {
    const records = await this.model.bulkCreate(data);

    return records.map(record => record.get({ plain: true }));
  }

  async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    const records = await this.model.findAll({
      ...QueryConverter.convertPaginatedFilterToSequelize(filter),
      ...QueryConverter.convertProjectionToSequelize(projection),
    });

    return records.map(record => record.get({ plain: true }));
  }

  async update(filter: Filter, patch: RecordData): Promise<void> {
    await this.model.update(patch, {
      ...(QueryConverter.convertPaginatedFilterToSequelize(filter) as UpdateOptions),
      fields: Object.keys(patch),
    });
  }

  async delete(filter: Filter): Promise<void> {
    await this.model.destroy({ ...QueryConverter.convertPaginatedFilterToSequelize(filter) });
  }

  async aggregate(
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const operation = aggregation.operation.toUpperCase();
    const field = aggregation.field ?? '*';
    const aggregateFieldName = '__aggregate__';

    const attributes: FindAttributeOptions = [[Fn(operation, Col(field)), aggregateFieldName]];

    if (aggregation.field) attributes.push(field);

    const groups: GroupOption = aggregation.groups?.map(group => {
      if (group.operation) {
        // TODO: Ensure operation names are the same on all DB engines.
        return Fn(group.operation?.toUpperCase(), Col(group.field));
      }

      return group.field;
    });

    const sequelizeFilter = QueryConverter.convertPaginatedFilterToSequelize(filter);

    if (sequelizeFilter.order) {
      sequelizeFilter.order = (sequelizeFilter.order as OrderItem[]).filter(
        orderClause => groups && aggregation.groups?.find(group => group.field === orderClause[0]),
      );
    }

    const aggregates = await this.model.findAll({
      ...sequelizeFilter,
      attributes,
      group: groups,
      limit,
    });

    const result = aggregates.map(aggregate => {
      const aggregateResult = {
        value: aggregate.get(aggregateFieldName) as number,
        group: {},
      };

      if (Array.isArray(groups) && groups.length > 0)
        aggregation.groups.forEach(group => {
          aggregateResult.group[group.field] = aggregate.get(group.field);
        });

      return aggregateResult;
    });

    return result;
  }
}
