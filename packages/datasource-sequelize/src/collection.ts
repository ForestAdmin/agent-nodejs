import {
  AggregateResult,
  Aggregation,
  AggregationOperation,
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
  FindOptions,
  fn as Fn,
  ModelDefined,
  ProjectionAlias,
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

    this.enableSearch();
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
      ...QueryConverter.convertPaginatedFilterToSequelize(this.model.name, filter),
      ...QueryConverter.convertProjectionToSequelize(projection),
    });

    return records.map(record => record.get({ plain: true }));
  }

  async update(filter: Filter, patch: RecordData): Promise<void> {
    await this.model.update(patch, {
      ...(QueryConverter.convertPaginatedFilterToSequelize(
        this.model.name,
        filter,
      ) as UpdateOptions),
      fields: Object.keys(patch),
    });
  }

  async delete(filter: Filter): Promise<void> {
    await this.model.destroy({
      ...QueryConverter.convertPaginatedFilterToSequelize(this.model.name, filter),
    });
  }

  async aggregate(
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const aggregateFieldName = '__aggregate__';
    const getGroupFieldName = (groupField: string) => `${groupField}__grouped__`;

    const unAmbigousField = (field: string) => {
      if (field.includes(':')) {
        const [associationName, fieldName] = field.split(':');
        const model = this.model.associations[associationName].target;

        return `${associationName}.${model.getAttributes()[fieldName].field}`;
      }

      return `${this.model.name}.${this.model.getAttributes()[field].field}`;
    };

    const { operation } = aggregation;
    let aggregationField = aggregation.field && unAmbigousField(aggregation.field);
    if (operation === AggregationOperation.Count || !aggregationField) aggregationField = '*';

    const aggregationAttribute: ProjectionAlias = [
      Fn(operation.toUpperCase(), Col(aggregationField)),
      aggregateFieldName,
    ];

    const { include } = QueryConverter.convertProjectionToSequelize(aggregation.projection, false);

    const groupAttributes = [];
    const groups = aggregation.groups
      ?.filter(group => !group.operation)
      .map(group => {
        const { field } = group;
        const groupFieldName = getGroupFieldName(field);
        const groupField = unAmbigousField(field);
        groupAttributes.push([Col(groupField), groupFieldName]);

        return groupFieldName;
      });

    // TODO hamdle date grouping properly another PR

    const query: FindOptions = {
      attributes: [...groupAttributes, aggregationAttribute],
      group: groups,
      where: QueryConverter.convertFilterToSequelize(filter).where,
      include,
      limit,
      order: [[Col(aggregateFieldName), 'DESC']], // FIXME handle properly order
      subQuery: false,
      raw: true,
    };

    const aggregates = await this.model.findAll(query);

    const result = aggregates.map(aggregate => {
      const aggregateResult = {
        value: aggregate[aggregateFieldName] as number,
        group: {},
      };

      aggregation.groups?.forEach(({ field }) => {
        aggregateResult.group[field] = aggregate[getGroupFieldName(field)];
      });

      return aggregateResult;
    });

    return result;
  }
}
