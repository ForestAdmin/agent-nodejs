import { Caller } from '../../interfaces/caller';
import { CollectionSchema, RelationSchema } from '../../interfaces/schema';
import { ComputedDefinition } from './types';
import { RecordData } from '../../interfaces/record';
import Aggregation, { AggregateResult } from '../../interfaces/query/aggregation';
import CollectionCustomizationContext from '../../context/collection-context';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';
import FieldValidator from '../../validation/field';
import Filter from '../../interfaces/query/filter/unpaginated';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import Projection from '../../interfaces/query/projection';
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

    if (computed.dependencies.length <= 0) {
      throw new Error(`Computed field '${this.name}.${name}' must have at least one dependency.`);
    }

    this.computeds[name] = computed;
    this.markSchemaAsDirty();
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const childProjection = projection.replace(path => rewriteField(this, path));
    const records = await this.childCollection.list(caller, filter, childProjection);
    const context = new CollectionCustomizationContext(this, caller);

    return computeFromRecords(context, this, childProjection, projection, records);
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    // No computed are used in the aggregation => just delegate to the underlying collection.
    if (!aggregation.projection.some(field => this.getComputed(field))) {
      return this.childCollection.aggregate(caller, filter, aggregation, limit);
    }

    // Fallback to full emulation.
    return aggregation.apply(
      await this.list(caller, filter, aggregation.projection),
      caller.timezone,
      limit,
    );
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
        type: 'Column',
      };
    }

    return schema;
  }
}
