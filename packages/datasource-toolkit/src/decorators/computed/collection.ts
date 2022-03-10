import {
  CollectionSchema,
  ColumnSchema,
  FieldTypes,
  RelationSchema,
} from '../../interfaces/schema';
import { ComputedDefinition, ProxyDefinition } from './types';
import { RecordData } from '../../interfaces/record';
import Aggregation, { AggregateResult } from '../../interfaces/query/aggregation';
import CollectionDecorator from '../collection-decorator';
import CollectionUtils from '../../utils/collection';
import DataSourceDecorator from '../datasource-decorator';
import FieldValidator from '../../validation/field';
import Filter from '../../interfaces/query/filter/unpaginated';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import Projection from '../../interfaces/query/projection';
import ProxyField from './fields/proxy';
import computeFromRecords from './helpers/compute-fields';
import rewriteField from './helpers/rewrite-projection';

/** Decorator injects computed fields */
export default class ComputedCollection extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<ComputedCollection>;
  protected computeds: Record<string, ComputedDefinition> = {};

  /** @internal */
  getComputed(path: string): ComputedDefinition {
    const index = path.indexOf(':');
    if (index === -1) return this.computeds[path];

    const { foreignCollection } = this.schema.fields[path.substring(0, index)] as RelationSchema;
    const association = this.dataSource.getCollection(foreignCollection);

    return association.getComputed(path.substring(index + 1));
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

  override async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    const childProjection = projection.replace(path => rewriteField(this, path));
    const records = await this.childCollection.list(filter, childProjection);

    return computeFromRecords(this, childProjection, projection, records);
  }

  override async aggregate(
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    // No computed are used in the aggregation => just delegate to the underlying collection.
    if (!aggregation.projection.some(field => this.getComputed(field))) {
      return this.childCollection.aggregate(filter, aggregation, limit);
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
