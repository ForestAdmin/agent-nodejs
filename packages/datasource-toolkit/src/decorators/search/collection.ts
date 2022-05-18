import { Caller } from '../../interfaces/caller';
import {
  CollectionSchema,
  ColumnSchema,
  FieldSchema,
  PrimitiveTypes,
} from '../../interfaces/schema';
import { DataSource } from '../../interfaces/collection';
import { SearchReplacer } from './types';
import CollectionCustomizationContext from '../../context/collection-context';
import CollectionDecorator from '../collection-decorator';
import ConditionTree from '../../interfaces/query/condition-tree/nodes/base';
import ConditionTreeFactory from '../../interfaces/query/condition-tree/factory';
import ConditionTreeLeaf from '../../interfaces/query/condition-tree/nodes/leaf';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import TypeGetter from '../../validation/type-getter';

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
    if (!filter?.search || SearchCollectionDecorator.checkEmptyString(filter.search)) {
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
    const searchableFields = SearchCollectionDecorator.getSearchFields(
      this.childCollection.schema,
      this.childCollection.dataSource,
      extended,
    );

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
    const { columnType, enumValues } = schema;
    let condition: ConditionTree = null;

    const type = columnType as PrimitiveTypes;
    const value = columnType === 'Number' ? Number(searchString) : searchString;
    const searchType = TypeGetter.get(value, type);

    if (
      SearchCollectionDecorator.isValidEnum(enumValues, searchString, type) ||
      searchType === 'Number' ||
      searchType === 'Uuid'
    ) {
      condition = new ConditionTreeLeaf(field, 'Equal', value);
    } else if (searchType === 'String') {
      condition = new ConditionTreeLeaf(field, 'Contains', value);
    }

    return condition;
  }

  private static isValidEnum(
    enumValues: string[],
    searchString: string,
    searchType: PrimitiveTypes,
  ): boolean {
    return (
      searchType === 'Enum' &&
      !!enumValues?.find(
        enumValue => enumValue.toLocaleLowerCase() === searchString.toLocaleLowerCase().trim(),
      )
    );
  }

  private static getSearchFields(
    schema: CollectionSchema,
    dataSource: DataSource,
    searchExtended: boolean,
  ): [string, ColumnSchema][] {
    const fields = Object.entries(schema.fields);

    if (searchExtended) SearchCollectionDecorator.getDeepFields(dataSource, fields);

    return fields.filter(([, fieldSchema]) =>
      SearchCollectionDecorator.isSearchable(fieldSchema),
    ) as [string, ColumnSchema][];
  }

  private static getDeepFields(dataSource: DataSource, fields: [string, FieldSchema][]) {
    fields.forEach(([name, field]) => {
      if (field.type === 'ManyToOne' || field.type === 'OneToOne') {
        const related = dataSource.getCollection(field.foreignCollection);
        fields.push(
          ...Object.entries(related.schema.fields).map(
            ([subName, columnSchema]) =>
              [`${name}:${subName}`, columnSchema] as [string, FieldSchema],
          ),
        );
      }
    });
  }

  private static checkEmptyString(searchString: string) {
    return searchString.trim().length === 0;
  }

  private static isSearchable(schema: FieldSchema): boolean {
    if (schema.type === 'Column') {
      const { columnType, filterOperators } = schema;

      if (columnType === 'Enum' || columnType === 'Number' || columnType === 'Uuid') {
        return filterOperators?.has('Equal');
      }

      if (columnType === 'String') {
        return filterOperators?.has('Contains');
      }
    }

    return false;
  }
}
