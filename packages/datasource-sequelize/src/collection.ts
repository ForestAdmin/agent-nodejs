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
import { col as Col, FindOptions, fn as Fn, ModelDefined, ProjectionAlias } from 'sequelize';

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

    const include = QueryConverter.getIncludeWithAttributesFromProjection(projection);

    const record = await this.model.findOne({
      attributes: projection.columns,
      where: actualId,
      include,
    });

    return record && record.get({ plain: true });
  }

  async create(data: RecordData[]): Promise<RecordData[]> {
    const records = await this.model.bulkCreate(data);

    return records.map(record => record.get({ plain: true }));
  }

  async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    const include = QueryConverter.getIncludeWithAttributesFromProjection(projection);

    let filterInclude = [];

    if (filter.conditionTree) {
      filterInclude = QueryConverter.getIncludeFromProjection(filter.conditionTree.projection);
    }

    const query: FindOptions = {
      attributes: projection.columns,
      where:
        filter.conditionTree &&
        QueryConverter.getWhereFromConditionTree(filter.conditionTree, this.model),
      include: include.concat(filterInclude),
      limit: filter.page?.limit,
      offset: filter.page?.skip,
      order: QueryConverter.getOrderFromSort(filter.sort),
      subQuery: false,
    };

    const records = await this.model.findAll(query);

    return records.map(record => record.get({ plain: true }));
  }

  async update(filter: Filter, patch: RecordData): Promise<void> {
    await this.model.update(patch, {
      where:
        filter.conditionTree &&
        QueryConverter.getWhereFromConditionTree(filter.conditionTree, this.model),
      fields: Object.keys(patch),
    });
  }

  async delete(filter: Filter): Promise<void> {
    await this.model.destroy({
      where:
        filter.conditionTree &&
        QueryConverter.getWhereFromConditionTree(filter.conditionTree, this.model),
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

    const include = QueryConverter.getIncludeFromProjection(aggregation.projection);

    let filterInclude = [];

    if (filter.conditionTree) {
      filterInclude = QueryConverter.getIncludeFromProjection(filter.conditionTree.projection);
    }

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

    // TODO handle date grouping properly another PR

    const query: FindOptions = {
      attributes: [...groupAttributes, aggregationAttribute],
      group: groups,
      where:
        filter.conditionTree &&
        QueryConverter.getWhereFromConditionTree(filter.conditionTree, this.model),
      include: include.concat(filterInclude),
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
