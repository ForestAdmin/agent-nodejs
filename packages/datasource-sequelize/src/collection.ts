import { FindOptions, ModelDefined, ProjectionAlias, col, fn } from 'sequelize';

import {
  AggregateResult,
  Aggregation,
  BaseCollection,
  Caller,
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
  private queryConverter: QueryConverter;

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
    this.queryConverter = new QueryConverter(this.model);

    const modelSchema = ModelConverter.convert(this.model, logger);

    this.enableCount();
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
    let include = this.queryConverter.getIncludeWithAttributesFromProjection(projection);

    if (filter.conditionTree) {
      include = include.concat(
        this.queryConverter.getIncludeFromProjection(filter.conditionTree.projection),
      );
    }

    if (filter.sort) {
      include = include.concat(
        this.queryConverter.getIncludeFromProjection(filter.sort.projection),
      );
    }

    const query: FindOptions = {
      attributes: projection.columns,
      where: this.queryConverter.getWhereFromConditionTree(filter.conditionTree),
      include,
      limit: filter.page?.limit,
      offset: filter.page?.skip,
      order: this.queryConverter.getOrderFromSort(filter.sort),
      subQuery: false,
    };

    const records = await this.model.findAll(query);

    return records.map(record => record.get({ plain: true }));
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    await this.model.update(patch, {
      where: await this.queryConverter.getWhereFromConditionTreeToByPassInclude(
        filter.conditionTree,
      ),
      fields: Object.keys(patch),
    });
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    await this.model.destroy({
      where: await this.queryConverter.getWhereFromConditionTreeToByPassInclude(
        filter.conditionTree,
      ),
    });
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

    let include = this.queryConverter.getIncludeFromProjection(aggregation.projection);

    if (filter.conditionTree) {
      include = include.concat(
        this.queryConverter.getIncludeFromProjection(filter.conditionTree.projection),
      );
    }

    const order = this.aggregationUtils.getOrder(aggregationFunction);

    const query: FindOptions = {
      attributes: [...groupAttributes, aggregationAttribute],
      group: groups,
      where: this.queryConverter.getWhereFromConditionTree(filter.conditionTree),
      include,
      limit,
      order: [order],
      subQuery: false,
      raw: true,
    };

    const rows = await this.model.findAll(query);

    return this.aggregationUtils.computeResult(rows, aggregation.groups);
  }
}
