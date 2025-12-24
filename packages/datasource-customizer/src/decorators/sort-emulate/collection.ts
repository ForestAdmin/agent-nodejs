import type {
  Caller,
  CollectionSchema,
  DataSourceDecorator,
  FieldSchema,
  PaginatedFilter,
  PlainSortClause,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import {
  CollectionDecorator,
  ConditionTreeFactory,
  FieldValidator,
  Filter,
  RecordUtils,
  SchemaUtils,
  Sort,
} from '@forestadmin/datasource-toolkit';

export default class SortEmulate extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<SortEmulate>;
  private readonly sorts: Map<string, Sort> = new Map();
  private readonly disabledSorts: Set<string> = new Set();

  emulateFieldSorting(name: string): void {
    this.replaceOrEmulateFieldSorting(name, null);
  }

  /**
   * Disable sorting on this field. This only prevents the end-user to sort on this field.
   * It will still be possible to sort on this field in the customizations code.
   * @param name name of the field
   * @deprecated this method will be removed soon.
   */
  disableFieldSorting(name: string): void {
    FieldValidator.validate(this, name);

    this.disabledSorts.add(name);
    this.markSchemaAsDirty();
  }

  replaceFieldSorting(name: string, equivalentSort: PlainSortClause[]): void {
    if (!equivalentSort) {
      throw new Error('A new sorting method should be provided to replace field sorting');
    }

    this.replaceOrEmulateFieldSorting(name, equivalentSort);
  }

  private replaceOrEmulateFieldSorting(name: string, equivalentSort: PlainSortClause[]): void {
    FieldValidator.validate(this, name);

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

  protected override refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [name, schema] of Object.entries(childSchema.fields)) {
      if (schema.type === 'Column') {
        let sortable = schema.isSortable;

        if (this.disabledSorts.has(name)) {
          // disableFieldSorting
          sortable = false;
        } else if (this.sorts.has(name)) {
          // replaceFieldSorting
          sortable = true;
        }

        fields[name] = { ...schema, isSortable: sortable };
      } else {
        fields[name] = schema;
      }
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
      const schema = SchemaUtils.getRelation(this.schema, prefix, this.name);
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

    const { foreignCollection } = SchemaUtils.getRelation(
      this.schema,
      path.substring(0, index),
      this.name,
    );
    const association = this.dataSource.getCollection(foreignCollection);

    return association.isEmulated(path.substring(index + 1));
  }
}
