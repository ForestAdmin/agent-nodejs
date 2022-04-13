import Model, {
  FindOptions,
  ModelDefined,
  ProjectionAlias,
  WhereOptions,
  col,
  fn,
} from 'sequelize';

import {
  AggregateResult,
  Aggregation,
  BaseCollection,
  Caller,
  ConditionTreeLeaf,
  DataSource,
  Filter,
  Logger,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import AggregationUtils from './utils/aggregation';
import ModelConverter from './utils/model-to-collection-schema-converter';
import QueryConverter from './utils/query-converter';

export default class SequelizeCollection extends BaseCollection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected model: ModelDefined<any, any>;
  private aggregationUtils: AggregationUtils;

  constructor(
    name: string,
    datasource: DataSource,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: ModelDefined<any, any>,
    logger?: Logger,
  ) {
    super(name, datasource);

    if (!model) throw new Error('Invalid (null) model instance.');

    this.model = model;
    this.aggregationUtils = new AggregationUtils(this.model);

    const modelSchema = ModelConverter.convert(this.model, logger);

    this.addFields(modelSchema.fields);
    this.addSegments(modelSchema.segments);
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const records = await this.model.bulkCreate(data);

    return records.map(record => record.get({ plain: true }));
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    let include = QueryConverter.getIncludeWithAttributesFromProjection(projection);

    if (filter.conditionTree) {
      include = include.concat(
        QueryConverter.getIncludeFromProjection(filter.conditionTree.projection),
      );
    }

    if (filter.sort) {
      include = include.concat(QueryConverter.getIncludeFromProjection(filter.sort.projection));
    }

    const query: FindOptions = {
      attributes: projection.columns,
      where: QueryConverter.getWhereFromConditionTree(this.model, filter.conditionTree),
      include,
      limit: filter.page?.limit,
      offset: filter.page?.skip,
      order: QueryConverter.getOrderFromSort(filter.sort),
      subQuery: false,
    };

    const records = await this.model.findAll(query);

    return records.map(record => record.get({ plain: true }));
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    await this.model.update(patch, {
      where: await this.buildWhereOptions(filter),
      fields: Object.keys(patch),
    });
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    await this.model.destroy({ where: await this.buildWhereOptions(filter) });
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    let aggregationField = aggregation.field;

    if (aggregation.operation === 'Count' || !aggregationField) {
      aggregationField = '*';
    } else {
      aggregationField = this.aggregationUtils.unAmbigousField(aggregationField);
    }

    const aggregationFunction = fn(aggregation.operation.toUpperCase(), col(aggregationField));
    const aggregationAttribute: ProjectionAlias = [
      aggregationFunction,
      this.aggregationUtils.aggregateFieldName,
    ];

    const { groups, attributes: groupAttributes } =
      this.aggregationUtils.getGroupAndAttributesFromAggregation(aggregation.groups);

    let include = QueryConverter.getIncludeFromProjection(aggregation.projection);

    if (filter.conditionTree) {
      include = include.concat(
        QueryConverter.getIncludeFromProjection(filter.conditionTree.projection),
      );
    }

    const order = this.aggregationUtils.getOrder(aggregationFunction);

    const query: FindOptions = {
      attributes: [...groupAttributes, aggregationAttribute],
      group: groups,
      where: QueryConverter.getWhereFromConditionTree(this.model, filter.conditionTree),
      include,
      limit,
      order: [order],
      subQuery: false,
      raw: true,
    };

    const rows = await this.model.findAll(query);

    return this.aggregationUtils.computeResult(rows, aggregation.groups);
  }

  private async buildWhereOptions(filter: Filter): Promise<WhereOptions> {
    const records = await this.model.findAll({
      attributes: [this.model.primaryKeyAttribute],
      where: QueryConverter.getWhereFromConditionTree(this.model, filter.conditionTree),
      include: QueryConverter.getIncludeFromProjection(
        filter.conditionTree?.projection ?? new Projection(),
      ),
    });

    return QueryConverter.getWhereFromConditionTree(
      this.model,
      new ConditionTreeLeaf(
        this.model.primaryKeyAttribute,
        'In',
        records.map(r => r.get(this.model.primaryKeyAttribute)),
      ),
    );
  }
}
