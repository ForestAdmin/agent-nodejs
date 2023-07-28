import {
  Caller,
  Collection,
  CollectionDecorator,
  CollectionSchema,
  ColumnSchema,
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  DataSourceDecorator,
  Operator,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import { validate as uuidValidate } from 'uuid';

import { SearchDefinition } from './types';
import CollectionCustomizationContext from '../../context/collection-context';

export default class SearchCollectionDecorator extends CollectionDecorator {
  override dataSource: DataSourceDecorator<SearchCollectionDecorator>;
  replacer: SearchDefinition = null;

  replaceSearch(replacer: SearchDefinition): void {
    this.replacer = replacer;
  }

  override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return { ...subSchema, searchable: true };
  }

  override async refineFilter(caller: Caller, filter?: PaginatedFilter): Promise<PaginatedFilter> {
    // Search string is not significant
    if (!filter?.search?.trim().length) {
      return filter?.override({ search: null });
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
    const keywords = search.split(' ').filter(kw => kw.length);
    const searchableFields = this.getFields(this.childCollection, extended);

    // Handle tags (!!! caution: tags are removed from the keywords array !!!)

    const conditions = [];
    conditions.push(...this.buildConditionFromTags(keywords, searchableFields));

    // Handle rest of the search string as one block (we search for remaining keywords in all
    // fields as a single block, not as individual keywords).
    //
    // This will be counter intuitive for users, but it's the only way to maintain
    // retro-compatibility with the old search system.

    if (keywords.length) {
      conditions.push(
        ConditionTreeFactory.union(
          ...searchableFields
            .map(([field, schema]) => this.buildOtherCondition(field, schema, keywords.join(' ')))
            .filter(Boolean),
        ),
      );
    }

    return ConditionTreeFactory.intersect(...conditions);
  }

  private buildConditionFromTags(keywords: string[], searchableFields: [string, ColumnSchema][]) {
    const conditions = [];

    for (let index = 0; index < keywords.length; index += 1) {
      let keyworkCpy = keywords[index];
      let negated = false;

      if (keyworkCpy.startsWith('-')) {
        negated = true;
        keyworkCpy = keyworkCpy.slice(1);
      }

      const parts = keyworkCpy.split(':');
      let condition: ConditionTree = null;

      if (parts.length >= 2 && parts[0] !== 'has') {
        const searchString = parts.pop();
        const field = parts.join(':');
        const fuzzy = this.lenientGetSchema(field);

        if (fuzzy)
          condition = this.buildOtherCondition(fuzzy.field, fuzzy.schema, searchString, negated);
      } else if (parts.length >= 2 && parts[0] === 'has') {
        const field = parts.slice(1).join(':');
        const fuzzy = this.lenientGetSchema(field);

        if (
          fuzzy &&
          fuzzy.schema.columnType === 'Boolean' &&
          fuzzy.schema.filterOperators.has('Equal')
        )
          condition = new ConditionTreeLeaf(fuzzy.field, 'Equal', !negated);
      } else if (negated && parts.length === 1) {
        condition = ConditionTreeFactory.intersect(
          ...searchableFields
            .map(([field, schema]) => this.buildOtherCondition(field, schema, parts[0], negated))
            .filter(Boolean),
        );
      }

      if (condition) {
        conditions.push(condition);
        keywords.splice(index, 1);
        index -= 1;
      }
    }

    return conditions;
  }

  private buildOtherCondition(
    field: string,
    schema: ColumnSchema,
    searchString: string,
    negated = false,
  ): ConditionTree {
    const { columnType, enumValues, filterOperators } = schema;
    const isNumber = Number(searchString).toString() === searchString;
    const isUuid = uuidValidate(searchString);
    const equalityOperator = negated ? 'NotEqual' : 'Equal';
    const containsOperator = negated ? 'NotContains' : 'Contains';
    const iContainsOperator = negated ? 'NotIContains' : 'IContains';

    if (columnType === 'Number' && isNumber && filterOperators?.has(equalityOperator)) {
      return new ConditionTreeLeaf(field, equalityOperator, Number(searchString));
    }

    if (columnType === 'Enum' && filterOperators?.has(equalityOperator)) {
      const searchValue = this.lenientFind(enumValues, searchString);

      if (searchValue) return new ConditionTreeLeaf(field, equalityOperator, searchValue);
    }

    if (columnType === 'String') {
      const isCaseSensitive = searchString.toLocaleLowerCase() !== searchString.toLocaleUpperCase();
      const supportsIContains = filterOperators?.has(iContainsOperator);
      const supportsContains = filterOperators?.has(containsOperator);
      const supportsEqual = filterOperators?.has(equalityOperator);

      // Perf: don't use case-insensitive operator when the search string is indifferent to case
      let operator: Operator;
      if (supportsIContains && (isCaseSensitive || !supportsContains)) operator = iContainsOperator;
      else if (supportsContains) operator = containsOperator;
      else if (supportsEqual) operator = equalityOperator;

      if (operator) return new ConditionTreeLeaf(field, operator, searchString);
    }

    if (columnType === 'Uuid' && isUuid && filterOperators?.has(equalityOperator)) {
      return new ConditionTreeLeaf(field, equalityOperator, searchString);
    }

    return null;
  }

  private getFields(collection: Collection, extended: boolean): [string, ColumnSchema][] {
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

  private lenientGetSchema(path: string): { field: string; schema: ColumnSchema } | null {
    const [prefix, suffix] = path.split(/:(.*)/);
    const fuzzyPrefix = prefix.toLocaleLowerCase().replace(/_/g, '');

    for (const [field, schema] of Object.entries(this.schema.fields)) {
      const fuzzyFieldName = field.toLocaleLowerCase().replace(/_/g, '');

      if (fuzzyPrefix === fuzzyFieldName) {
        if (!suffix && schema.type === 'Column') {
          return { field, schema };
        }

        if (suffix && (schema.type === 'ManyToOne' || schema.type === 'OneToOne')) {
          const related = this.dataSource.getCollection(schema.foreignCollection);
          const fuzzy = related.lenientGetSchema(suffix);

          if (fuzzy) return { field: `${field}:${fuzzy.field}`, schema: fuzzy.schema };
        }
      }
    }

    return null;
  }

  private lenientFind(haystack: string[], needle: string): string {
    return (
      haystack?.find(v => v === needle.trim()) ??
      haystack?.find(v => v.toLocaleLowerCase() === needle.toLocaleLowerCase().trim())
    );
  }
}
