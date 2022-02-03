import Aggregation, { AggregateResult } from '../../interfaces/query/aggregation';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import Projection from '../../interfaces/query/projection';
import { CompositeId, RecordData } from '../../interfaces/record';
import { CollectionSchema, ColumnSchema, FieldTypes } from '../../interfaces/schema';
import CollectionUtils from '../../utils/collection';
import FieldValidator from '../../validation/field';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';
import ProxyField from './fields/proxy';
import computeFromRecords from './helpers/compute-fields';
import rewriteField from './helpers/rewrite-projection';
import { ComputedDefinition, ProxyDefinition } from './types';

/** Decorator injects computed fields */
export default class ComputedCollection extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<ComputedCollection>;
  protected computeds: Record<string, ComputedDefinition> = {};

  /** @internal */
  getComputed(path: string): ComputedDefinition {
    const associationPath = path.split(':');
    const columnPath = associationPath.pop();
    const association = CollectionUtils.getRelation(this, associationPath.join(':'));

    return (association as ComputedCollection).computeds[columnPath];
  }

  registerComputed(name: string, computed: ComputedDefinition): void {
    // Check that all dependencies exist and are columns
    for (const field of computed.dependencies) {
      FieldValidator.validate(this, field);
    }

    this.computeds[name] = computed;
  }

  registerProxy(name: string, proxy: ProxyDefinition): void {
    FieldValidator.validate(this, proxy.path);
    const schema = CollectionUtils.getFieldSchema(this, proxy.path) as ColumnSchema;

    this.registerComputed(name, new ProxyField(this, { ...proxy, type: schema.columnType }));
  }

  override async getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    const childProjection = projection.replace(path => rewriteField(this, path));
    const childRecord = await this.childCollection.getById(id, childProjection);
    if (!childRecord) return null;

    const records = await computeFromRecords(this, childProjection, projection, [childRecord]);

    return records[0];
  }

  override async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    const childProjection = projection.replace(path => rewriteField(this, path));
    const records = await this.childCollection.list(filter, childProjection);

    return computeFromRecords(this, childProjection, projection, records);
  }

  override async aggregate(
    filter: PaginatedFilter,
    aggregation: Aggregation,
  ): Promise<AggregateResult[]> {
    // No computed are used in the aggregation => just delegate to the underlying collection.
    if (!aggregation.projection.some(field => this.getComputed(field))) {
      return this.childCollection.aggregate(filter, aggregation);
    }

    // Fallback to full emulation.
    return aggregation.apply(await this.list(filter, aggregation.projection), filter.timezone);
  }

  protected refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const schema = { ...childSchema, fields: { ...childSchema.fields } };

    for (const [name, computed] of Object.entries(this.computeds)) {
      schema.fields[name] = {
        columnType: computed.columnType,
        defaultValue: computed.defaultValue,
        enumValues: computed.enumValues,
        filterOperators: new Set(),
        isPrimaryKey: false,
        isReadOnly: true,
        isSortable: false,
        type: FieldTypes.Column,
      };
    }

    return schema;
  }
}
