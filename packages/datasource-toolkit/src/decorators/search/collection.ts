import { validate as uuidValidate } from 'uuid';

import { Caller } from '../../interfaces/caller';
import { Collection } from '../../interfaces/collection';
import { CollectionSchema, ColumnSchema } from '../../interfaces/schema';
import { Operator } from '../../interfaces/query/condition-tree/nodes/operators';
import { SearchReplacer } from './types';
import CollectionCustomizationContext from '../../context/collection-context';
import CollectionDecorator from '../collection-decorator';
import ConditionTree from '../../interfaces/query/condition-tree/nodes/base';
import ConditionTreeFactory from '../../interfaces/query/condition-tree/factory';
import ConditionTreeLeaf from '../../interfaces/query/condition-tree/nodes/leaf';
import PaginatedFilter from '../../interfaces/query/filter/paginated';

export default class SearchCollectionDecorator extends CollectionDecorator {
  replacer: SearchReplacer = null;

  replaceSearch(replacer: SearchReplacer): void {
    this.replacer = replacer;
  }

  public override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return { ...subSchema, searchable: true };
  }

  public override async refineFilter(
    caller: Caller,
    filter?: PaginatedFilter,
  ): Promise<PaginatedFilter> {
    // Search string is not significant
    if (!filter?.search?.trim().length) {
      return filter.override({ search: null });
    }

    // Implement search ourselves
    if (this.replacer || !this.childCollection.schema.searchable) {
      const ctx = new CollectionCustomizationContext(this, caller);
      let tree = this.defaultReplacer(filter.search, filter.searchExtended);

      if (this.replacer) {
        const plainTree = await this.replacer(filter.search, filter.searchExtended, ctx);
        tree = ConditionTreeFactory.fromPlainObject(plainTree);
      }

      // Note that if no fields are searchable with the provided searchString, the conditions
      // array might be empty, which will create a condition returning zero records
      // (this is the desired behavior).
      return filter.override({
        conditionTree: ConditionTreeFactory.intersect(filter.conditionTree, tree),
        search: null,
      });
    }

    // Let subcollection deal with the search
    return filter;
  }

  private defaultReplacer(search: string, extended: boolean): ConditionTree {
    const searchableFields = SearchCollectionDecorator.getFields(this.childCollection, extended);
    const conditions = searchableFields
      .map(([field, schema]) => SearchCollectionDecorator.buildCondition(field, schema, search))
      .filter(Boolean);

    return ConditionTreeFactory.union(...conditions);
  }

  private static buildCondition(
    field: string,
    schema: ColumnSchema,
    searchString: string,
  ): ConditionTree {
    const { columnType, enumValues, filterOperators } = schema;
    const isNumber = Number(searchString).toString() === searchString;
    const isUuid = uuidValidate(searchString);

    if (columnType === 'Number' && isNumber && filterOperators?.has('Equal')) {
      return new ConditionTreeLeaf(field, 'Equal', Number(searchString));
    }

    if (columnType === 'Enum' && filterOperators?.has('Equal')) {
      const searchValue = SearchCollectionDecorator.lenientFind(enumValues, searchString);

      if (searchValue) return new ConditionTreeLeaf(field, 'Equal', searchValue);
    }

    if (columnType === 'String') {
      let operator: Operator;

      // Perf: don't use case-insensitive operator for numbers
      if (!isNumber && filterOperators?.has('IContains')) operator = 'IContains';
      else if (filterOperators?.has('Contains')) operator = 'Contains';
      else if (filterOperators?.has('Equal')) operator = 'Equal';

      if (operator) return new ConditionTreeLeaf(field, operator, searchString);
    }

    if (columnType === 'Uuid' && isUuid && filterOperators?.has('Equal')) {
      return new ConditionTreeLeaf(field, 'Equal', searchString);
    }

    return null;
  }

  private static getFields(collection: Collection, extended: boolean): [string, ColumnSchema][] {
    const fields: [string, ColumnSchema][] = [];

    for (const [name, field] of Object.entries(collection.schema.fields)) {
      if (field.type === 'Column') fields.push([name, field]);

      if (extended && (field.type === 'ManyToOne' || field.type === 'OneToOne')) {
        const related = collection.dataSource.getCollection(field.foreignCollection);

        for (const [subName, subField] of Object.entries(related.schema.fields))
          if (subField.type === 'Column') fields.push([`${name}:${subName}`, subField]);
      }
    }

    return fields;
  }

  private static lenientFind(haystack: string[], needle: string): string {
    return (
      haystack?.find(v => v === needle.trim()) ??
      haystack?.find(v => v.toLocaleLowerCase() === needle.toLocaleLowerCase().trim())
    );
  }
}
