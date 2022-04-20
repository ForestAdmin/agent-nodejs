import { Caller } from '../../interfaces/caller';
import {
  CollectionSchema,
  ColumnSchema,
  FieldSchema,
  RelationSchema,
} from '../../interfaces/schema';
import { RecordData } from '../../interfaces/record';
import CollectionDecorator from '../collection-decorator';
import ConditionTreeFactory from '../../interfaces/query/condition-tree/factory';
import DataSourceDecorator from '../datasource-decorator';
import FieldValidator from '../../validation/field';
import Filter from '../../interfaces/query/filter/unpaginated';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import Projection from '../../interfaces/query/projection';
import RecordUtils from '../../utils/record';
import Sort, { PlainSortClause } from '../../interfaces/query/sort';

export default class SortEmulate extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<SortEmulate>;
  private readonly sorts: Map<string, Sort> = new Map();

  emulateFieldSorting(name: string): void {
    this.replaceFieldSorting(name, null);
  }

  replaceFieldSorting(name: string, equivalentSort: PlainSortClause[]): void {
    FieldValidator.validate(this, name);

    const field = this.childCollection.schema.fields[name] as ColumnSchema;
    if (!field) throw new Error('Cannot replace sort on relation');

    this.sorts.set(name, equivalentSort ? new Sort(...equivalentSort) : null);
    this.markSchemaAsDirty();
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const childFilter = filter.override({
      sort: filter.sort?.replaceClauses(clause => this.rewritePlainSortClause(clause)),
    });

    if (!childFilter.sort?.some(({ field }) => this.isEmulated(field))) {
      return this.childCollection.list(caller, childFilter, projection);
    }

    // Fetch the whole collection, but only with the fields we need to sort
    let referenceRecords: RecordData[];
    referenceRecords = await this.childCollection.list(
      caller,
      childFilter.override({ sort: null, page: null }),
      childFilter.sort.projection.withPks(this),
    );
    referenceRecords = childFilter.sort.apply(referenceRecords);
    if (childFilter.page) referenceRecords = childFilter.page.apply(referenceRecords);

    // We now have the information we need to sort by the field
    const newFilter = new Filter({
      conditionTree: ConditionTreeFactory.matchRecords(this.schema, referenceRecords),
    });

    let records: RecordData[];
    records = await this.childCollection.list(caller, newFilter, projection.withPks(this));
    records = this.sortRecords(referenceRecords, records);
    records = projection.apply(records);

    return records;
  }

  protected refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [name, schema] of Object.entries(childSchema.fields)) {
      fields[name] =
        this.sorts.has(name) && schema.type === 'Column' ? { ...schema, isSortable: true } : schema;
    }

    return { ...childSchema, fields };
  }

  private sortRecords(referenceRecords: RecordData[], records: RecordData[]): RecordData[] {
    const positionById: Record<string, number> = {};
    const sorted = new Array(records.length);

    for (const [index, record] of referenceRecords.entries()) {
      positionById[RecordUtils.getPrimaryKey(this.schema, record).join('|')] = index;
    }

    for (const record of records) {
      const id = RecordUtils.getPrimaryKey(this.schema, record).join('|');
      sorted[positionById[id]] = record;
    }

    return sorted;
  }

  private rewritePlainSortClause(clause: PlainSortClause): Sort {
    // Order by is targeting a field on another collection => recurse.
    if (clause.field.includes(':')) {
      const [prefix] = clause.field.split(':');
      const schema = this.schema.fields[prefix] as RelationSchema;
      const association = this.dataSource.getCollection(schema.foreignCollection);

      return new Sort(clause)
        .unnest()
        .replaceClauses(subClause => association.rewritePlainSortClause(subClause))
        .nest(prefix);
    }

    // Field that we own: recursively replace using equivalent sort
    let equivalentSort = this.sorts.get(clause.field);

    if (equivalentSort) {
      if (!clause.ascending) equivalentSort = equivalentSort.inverse();

      return equivalentSort.replaceClauses(subClause => this.rewritePlainSortClause(subClause));
    }

    return new Sort(clause);
  }

  private isEmulated(path: string): boolean {
    const index = path.indexOf(':');
    if (index === -1) return this.sorts.has(path);

    const { foreignCollection } = this.schema.fields[path.substring(0, index)] as RelationSchema;
    const association = this.dataSource.getCollection(foreignCollection);

    return association.isEmulated(path.substring(index + 1));
  }
}
