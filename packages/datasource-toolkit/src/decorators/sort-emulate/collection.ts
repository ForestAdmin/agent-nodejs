import PaginatedFilter from '../../interfaces/query/filter/paginated';
import Projection from '../../interfaces/query/projection';
import Sort from '../../interfaces/query/sort';
import { RecordData } from '../../interfaces/record';
import { CollectionSchema } from '../../interfaces/schema';
import CollectionUtils from '../../utils/collection';
import ConditionTreeUtils from '../../utils/condition-tree';
import RecordUtils from '../../utils/record';
import FieldValidator from '../../validation/field';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';
import rewriteSort from './helpers/rewrite-sort';

export default class SortEmulate extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<SortEmulate>;
  private readonly sorts: Map<string, Sort> = new Map();

  /** @internal */
  getSort(path: string): Sort {
    const associationPath = path.split(':');
    const columnPath = associationPath.pop();
    const association = CollectionUtils.getRelation(this, associationPath.join(':'));
    const sort = (association as SortEmulate).sorts.get(columnPath);

    return sort ? sort.nest(associationPath.join(':')) : null;
  }

  emulateSort(name: string): void {
    this.sorts.set(name, null);
  }

  implementSort(name: string, equivalentSort: Sort): void {
    FieldValidator.validate(this, name);

    const field = this.childCollection.schema.fields[name];

    if (!field) {
      throw new Error(`No such field '${name}'`);
    }

    this.sorts.set(name, equivalentSort);
  }

  protected refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields = {};

    for (const [name, schema] of Object.entries(childSchema.fields)) {
      fields[name] = this.sorts.has(name) ? { ...schema, sortable: true } : schema;
    }

    return { ...childSchema, fields };
  }

  override async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    const childFilter = filter.override({
      sort: filter.sort.replaceClauses(clause => rewriteSort(this, clause)),
    });

    let referenceRecords: RecordData[];

    if (childFilter.sort.projection.some(field => this.getSort(field))) {
      // Fetch the whole collection, but only with the fields we need to sort
      referenceRecords = await this.list(
        childFilter.override({ sort: null, page: null }),
        childFilter.sort.projection.withPks(this),
      );
      referenceRecords = childFilter.sort.apply(referenceRecords);
      referenceRecords = childFilter.page.apply(referenceRecords);

      // We now have the information we need to sort by the computed field
      childFilter.conditionTree = ConditionTreeUtils.matchRecords(this.schema, referenceRecords);
      childFilter.sort = null;
    }

    const records = await this.childCollection.list(childFilter, projection);

    return referenceRecords ? this.sort(referenceRecords, records) : records;
  }

  private sort(referenceRecords: RecordData[], records: RecordData[]): RecordData[] {
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
}
