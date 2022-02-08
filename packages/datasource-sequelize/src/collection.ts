import {
  FindAttributeOptions,
  GroupOption,
  ModelDefined,
  OrderItem,
  Sequelize,
  UpdateOptions,
} from 'sequelize';
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
import {
  convertFilterToSequelize,
  convertPaginatedFilterToSequelize,
} from './utils/filter-converter';

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

  override async getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    const actualId = {};

    SchemaUtils.getPrimaryKeys(this.schema).forEach((field, index) => {
      actualId[field] = id[index];
    });

    const record = await this.model.findOne({
      where: actualId,
      attributes: projection,
    });

    return record && record.get({ plain: true });
  }

  async create(data: RecordData[]): Promise<RecordData[]> {
    const records = await this.model.bulkCreate(data);

    return records.map(record => record.get({ plain: true }));
  }

  async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    const records = await this.model.findAll({
      ...convertPaginatedFilterToSequelize(filter),
      attributes: projection,
    });

    return records.map(record => record.get({ plain: true }));
  }

  async update(filter: Filter, patch: RecordData): Promise<void> {
    await this.model.update(patch, {
      ...(convertPaginatedFilterToSequelize(filter) as UpdateOptions),
      fields: Object.keys(patch),
    });
  }

  async delete(filter: Filter): Promise<void> {
    await this.model.destroy({ ...convertPaginatedFilterToSequelize(filter) });
  }

  async aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]> {
    const operation = aggregation.operation.toUpperCase();
    const field = aggregation.field ?? '*';
    const aggregateFieldName = '__aggregate__';

    const attributes: FindAttributeOptions = [
      [this.sequelize.fn(operation, this.sequelize.col(field)), aggregateFieldName],
    ];

    if (aggregation.field) attributes.push(field);

    const groups: GroupOption = aggregation.groups?.map(group => {
      if (group.operation) {
        // TODO: Ensure operation names are the same on all DB engines.
        return this.sequelize.fn(group.operation?.toUpperCase(), this.sequelize.col(group.field));
      }

      return group.field;
    });

    const sequelizeFilter = convertPaginatedFilterToSequelize(filter);

    if (sequelizeFilter.order) {
      sequelizeFilter.order = (sequelizeFilter.order as OrderItem[]).filter(
        orderClause => groups && aggregation.groups?.find(group => group.field === orderClause[0]),
      );
    }

    const aggregates = await this.model.findAll({
      ...sequelizeFilter,
      attributes,
      group: groups,
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
