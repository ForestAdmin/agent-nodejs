import Sort from '../../interfaces/query/sort';
import { CollectionSchema } from '../../interfaces/schema';
import FieldValidator from '../../validation/field';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';

export default class SortEmulate extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<SortEmulate>;

  private readonly sorts: Map<string, Sort> = new Map();

  /** @internal */
  getSort(name: string): Sort {
    return this.sorts.get(name);
  }

  emulateSort(name: string): void {
    this.sorts.set(name, null);
  }

  replaceSort(name: string, equivalentSort: Sort): void {
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

  // override async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
  //   // We may have computed fields left in the sort.
  //   let forcedIdsOrder: Record<string, number> = null;

  //   if (childFilter?.sort.projection.some(field => this.isComputed(field))) {
  //     // Fetch the whole collection, but only with the fields we need to sort
  //     let records: RecordData[] = await this.list(
  //       childFilter.override({ sort: null, page: null }),
  //       childFilter.sort.projection.withPks(this),
  //     );
  //     records = childFilter.sort.apply(records);
  //     records = childFilter.page.apply(records);

  //     // We now have the information we need to sort by the computed field
  //     childFilter.conditionTree = ConditionTreeUtils.matchRecords(this.schema, records);
  //     childFilter.sort = null;

  //     forcedIdsOrder = {};
  //     records.forEach((record, index) => {
  //       const packedId = RecordUtils.getPrimaryKey(this.schema, record).join('|');
  //       forcedIdsOrder[packedId] = index;
  //     });
  //   }

  //   const records = await this.childCollection.list(childFilter, childProjection);

  //   if (forcedIdsOrder) {
  //     records.sort((r1, r2) => {
  //       const packedId1 = RecordUtils.getPrimaryKey(this.schema, r1).join('|');
  //       const packedId2 = RecordUtils.getPrimaryKey(this.schema, r2).join('|');

  //       return forcedIdsOrder[packedId1] < forcedIdsOrder[packedId2] ? -1 : 1;
  //     });
  //   }

  //   return computeFields(this, projection, records);
  // }
}
