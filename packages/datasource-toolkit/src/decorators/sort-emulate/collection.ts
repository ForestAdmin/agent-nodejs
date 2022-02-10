import PaginatedFilter from '../../interfaces/query/filter/paginated';
import Projection from '../../interfaces/query/projection';
import Sort, { SortClause } from '../../interfaces/query/sort';
import { RecordData } from '../../interfaces/record';
import {
  CollectionSchema,
  ColumnSchema,
  FieldSchema,
  FieldTypes,
  RelationSchema,
} from '../../interfaces/schema';
import CollectionUtils from '../../utils/collection';
import ConditionTreeFactory from '../../interfaces/query/condition-tree/factory';
import RecordUtils from '../../utils/record';
import FieldValidator from '../../validation/field';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';

export default class SortEmulate extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<SortEmulate>;
  private readonly sorts: Map<string, Sort> = new Map();

  emulateSort(name: string): void {
    this.implementSort(name, null);
  }

  implementSort(name: string, equivalentSort: Sort): void {
    FieldValidator.validate(this, name);

    const field = this.childCollection.schema.fields[name] as ColumnSchema;
    if (!field) throw new Error('Cannot replace sort on relation');

    this.sorts.set(name, equivalentSort);
  }

  override async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    const childFilter = filter.override({
      sort: filter.sort?.replaceClauses(clause => this.rewriteSortClause(clause)),
    });

    if (!childFilter.sort?.some(({ field }) => this.isEmulated(field))) {
      return this.childCollection.list(childFilter, projection);
    }

    // Fetch the whole collection, but only with the fields we need to sort
    let referenceRecords: RecordData[];
    referenceRecords = await this.childCollection.list(
      childFilter.override({ sort: null, page: null }),
      childFilter.sort.projection.withPks(this),
    );
    referenceRecords = childFilter.sort.apply(referenceRecords);
    if (childFilter.page) referenceRecords = childFilter.page.apply(referenceRecords);

    // We now have the information we need to sort by the field
    childFilter.conditionTree = ConditionTreeFactory.matchRecords(this.schema, referenceRecords);
    childFilter.sort = null;

    let records: RecordData[];
    records = await this.childCollection.list(childFilter, projection.withPks(this));
    records = this.sortRecords(referenceRecords, records);
    records = projection.apply(records);

    return records;
  }

  protected refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [name, schema] of Object.entries(childSchema.fields)) {
      fields[name] =
        this.sorts.has(name) && schema.type === FieldTypes.Column
          ? { ...schema, isSortable: true }
          : schema;
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

  private rewriteSortClause(clause: SortClause): Sort {
    // Order by is targeting a field on another collection => recurse.
    if (clause.field.includes(':')) {
      const [prefix] = clause.field.split(':');
      const schema = this.schema.fields[prefix] as RelationSchema;
      const association = this.dataSource.getCollection(schema.foreignCollection);

      return new Sort(clause)
        .unnest()
        .replaceClauses(subClause => association.rewriteSortClause(subClause))
        .nest(prefix);
    }

    // Field that we own: recursively replace using equivalent sort
    let equivalentSort = this.sorts.get(clause.field);

    if (equivalentSort) {
      if (!clause.ascending) equivalentSort = equivalentSort.inverse();

      return equivalentSort.replaceClauses(subClause => this.rewriteSortClause(subClause));
    }

    return new Sort(clause);
  }

  private isEmulated(path: string): boolean {
    const associationPath = path.split(':');
    const columnPath = associationPath.pop();
    const association = CollectionUtils.getRelation(this, associationPath.join(':'));

    return (association as SortEmulate).sorts.has(columnPath);
  }
}
