import {
  AggregateResult,
  Aggregation,
  BaseCollection,
  CollectionSchema,
  CompositeId,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import CollectionSchemaConverter from './utils/collectionSchemaToModelAttributesConverter';
import ModelConverter from './utils/modelToCollectionSchemaConverter';

import { convertPaginatedFilterToSequelize } from './utils/filterConverter';

export default class SequelizeCollection extends BaseCollection {
  protected model = null;
  protected sequelize = null;

  constructor(name, datasource: DataSource, sequelize, schema?: CollectionSchema) {
    super(name, datasource);

    // TODO: Prevent initialization if no Sequelize instance is given?
    if (sequelize) {
      this.sequelize = sequelize;

      if (schema) {
        this.model = sequelize.define(name, CollectionSchemaConverter.convert(schema)) || null;

        // FIXME: Remove when ModelToCollectionSchemaConverter is done.
        this.addFields(schema.fields);
        if (schema.searchable) this.enableSearch();
        this.addSegments(schema.segments);
      } else {
        this.model = sequelize[name] ?? null;
      }
    }

    if (this.model) {
      const modelSchema = ModelConverter.convert(this.model);

      this.addFields(modelSchema.fields);
      if (modelSchema.searchable) this.enableSearch();
      this.addSegments(modelSchema.segments);
    }
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
    // FIXME: Properly convert `operation`.
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
