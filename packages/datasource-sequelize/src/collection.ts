import type {
  AggregateResult,
  Aggregation,
  Caller,
  ColumnSchema,
  DataSource,
  Filter,
  Logger,
  PaginatedFilter,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import type {
  BindOrReplacements,
  FindOptions,
  ModelDefined,
  ProjectionAlias,
  Sequelize,
} from 'sequelize';

import { BaseCollection, CollectionUtils, Projection } from '@forestadmin/datasource-toolkit';
import { DataTypes, QueryTypes } from 'sequelize';

import AggregationUtils from './utils/aggregation';
import handleErrors from './utils/error-handler';
import ModelConverter from './utils/model-to-collection-schema-converter';
import QueryConverter from './utils/query-converter';
import Serializer from './utils/serializer';

type Replacements = BindOrReplacements;

export default class SequelizeCollection extends BaseCollection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected model: ModelDefined<any, any>;
  private col: Sequelize['col'];
  private fn: Sequelize['fn'];

  private aggregationUtils: AggregationUtils;
  private queryConverter: QueryConverter;

  constructor(
    name: string,
    datasource: DataSource,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: ModelDefined<any, any>,
    logger?: Logger,
  ) {
    if (!model) throw new Error('Invalid (null) model instance.');

    super(name, datasource, {
      sequelize: model.sequelize,
      model,
      /**
       * Executes a raw SQL query using Sequelize Replacements by default
       * @see {@link https://sequelize.org/docs/v6/core-concepts/raw-queries/#replacements}
       * Use option { syntax: "bind" } for Sequelize Bind
       * @see {@link https://sequelize.org/docs/v6/core-concepts/raw-queries/#bind-parameter}
       *
       * @param {string} sql
       * @param {Replacements} replacements
       * @param {{syntax?:'bind'|'replacements'}} options?
       * @returns {any}
       */
      rawQuery: async (
        sql: string,
        replacements: Replacements,
        options?: { syntax?: 'bind' | 'replacements' },
      ) => {
        const opt = { syntax: 'replacements', ...options };
        const result = await model.sequelize.query(sql, {
          type: QueryTypes.RAW,
          plain: false,
          raw: true,
          ...(opt.syntax === 'bind' ? { bind: replacements } : { replacements }),
        });

        return result?.[0];
      },
    });

    this.model = model;
    this.col = this.model.sequelize.col;
    this.fn = this.model.sequelize.fn;

    this.aggregationUtils = new AggregationUtils(this.model);
    this.queryConverter = new QueryConverter(this.model);

    const modelSchema = ModelConverter.convert(this.model, logger);

    this.enableCount();
    this.addFields(modelSchema.fields);
    this.addSegments(modelSchema.segments);
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const records = await handleErrors('create', () => this.model.bulkCreate(data));

    // Dynamically get non-virtual fields because we don't support virtual fields
    const attributes = this.model.rawAttributes;
    const nonVirtualFields = Object.keys(attributes).filter(
      field => !(attributes[field].type instanceof DataTypes.VIRTUAL),
    );

    // Exclude virtual fields and serialize the records
    return records.map(record => {
      const plainRecord = record.get({ plain: true });
      const filteredRecord = Object.fromEntries(
        Object.entries(plainRecord).filter(([key]) => nonVirtualFields.includes(key)),
      );

      return Serializer.serialize(filteredRecord, attributes);
    });
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const query: FindOptions = {
      attributes: projection.columns,
      where: this.queryConverter.getWhereFromConditionTree(filter.conditionTree),
      include: this.queryConverter.getIncludeFromProjection(
        // Bugfix [CU-860rc94dq](https://app.clickup.com/t/860rc94dq)
        // When we provide sequelize with an include which has empty `.attributes` in it, it stops
        // there and doesn't go further in the include tree.
        // To ensure that no `.attributes` are not empty, we add the pk of each collection in the
        // projection.
        //
        // include: [{
        //   association: 'users',
        //   attributes: [],
        //   include: { association: 'posts', attributes: ['i_want_this_field'] }
        // }]
        projection.withPks(this),
        new Projection().union(filter.conditionTree?.projection, filter.sort?.projection),
      ),
      limit: filter.page?.limit,
      offset: filter.page?.skip,
      order: this.queryConverter.getOrderFromSort(filter.sort),
      subQuery: false,
    };

    const records = await this.model.findAll(query);
    const rawRecords = records.map(record =>
      Serializer.serialize(record.get({ plain: true }), this.model.rawAttributes),
    );

    // Use projection to filter out the unwanted primary keys that were added to the projection
    // so that sequelize can do its job.
    return projection.apply(rawRecords);
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const options = {
      where: await this.queryConverter.getWhereFromConditionTreeToByPassInclude(
        filter.conditionTree,
      ),
      fields: Object.keys(patch),
    };

    await handleErrors('update', () => this.model.update(patch, options));
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    const options = {
      where: await this.queryConverter.getWhereFromConditionTreeToByPassInclude(
        filter.conditionTree,
      ),
    };

    await handleErrors('delete', () => this.model.destroy(options));
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    let aggregationField = aggregation.field;
    let aggregationFieldSchema: ColumnSchema | undefined;

    if (aggregation.operation === 'Count' || !aggregationField) {
      aggregationField = '*';
    } else {
      aggregationField = this.aggregationUtils.quoteField(aggregationField);
      aggregationFieldSchema = CollectionUtils.getFieldSchema(
        this,
        aggregation.field,
      ) as ColumnSchema;
    }

    const aggregationFunction = this.fn(
      aggregation.operation.toUpperCase(),
      this.col(aggregationField),
    );

    const aggregationAttribute: ProjectionAlias = [
      aggregationFunction,
      this.aggregationUtils.aggregateFieldName,
    ];

    const { groups, attributes } = this.aggregationUtils.getGroupAndAttributesFromAggregation(
      aggregation.groups,
    );

    const query: FindOptions = {
      attributes: [...attributes, aggregationAttribute],
      group: groups,
      where: this.queryConverter.getWhereFromConditionTree(filter.conditionTree),
      include: this.queryConverter.getIncludeFromProjection(
        new Projection(),
        aggregation.projection.union(filter.conditionTree?.projection),
      ),
      limit,
      order: [this.aggregationUtils.getOrder(aggregationFunction)],
      subQuery: false,
      raw: true,
    };

    const rows = await this.model.findAll(query);

    return this.aggregationUtils.computeResult(
      rows,
      aggregation.groups,
      !aggregationFieldSchema || aggregationFieldSchema?.columnType === 'Number',
    );
  }
}
