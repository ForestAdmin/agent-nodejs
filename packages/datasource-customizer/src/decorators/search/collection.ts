import {
  Caller,
  Collection,
  CollectionDecorator,
  CollectionSchema,
  ColumnSchema,
  ConditionTree,
  ConditionTreeFactory,
  DataSourceDecorator,
  PaginatedFilter,
  PlainConditionTree,
} from '@forestadmin/datasource-toolkit';

import CollectionSearchContext, { SearchOptions } from './collection-search-context';
import normalizeName from './normalize-name';
import { extractSpecifiedFields, generateConditionTree, parseQuery } from './parse-query';
import { SearchDefinition } from './types';

export default class SearchCollectionDecorator extends CollectionDecorator {
  override dataSource: DataSourceDecorator<SearchCollectionDecorator>;
  replacer: SearchDefinition = null;
  searchable = true;

  replaceSearch(replacer: SearchDefinition): void {
    this.replacer = replacer;
  }

  disable() {
    this.searchable = false;
  }

  override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return { ...subSchema, searchable: this.searchable };
  }

  override async refineFilter(caller: Caller, filter?: PaginatedFilter): Promise<PaginatedFilter> {
    // Search string is not significant
    if (!filter?.search?.trim().length) {
      return filter?.override({ search: null });
    }

    // Implement search ourselves
    if (this.replacer || !this.childCollection.schema.searchable) {
      const ctx = new CollectionSearchContext(
        this,
        caller,
        this.generatePlainSearchFilter.bind(this, caller),
      );
      let tree: ConditionTree;

      if (this.replacer) {
        const plainTree = await this.replacer(filter.search, filter.searchExtended, ctx);
        tree = ConditionTreeFactory.fromPlainObject(plainTree);
      } else {
        tree = this.generateSearchFilter(caller, filter.search, {
          extended: filter.searchExtended,
        });
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

  private generateSearchFilter(
    caller: Caller,
    searchText: string,
    options?: SearchOptions,
  ): ConditionTree {
    const parsedQuery = parseQuery(searchText);

    const specifiedFields = options?.onlyFields ? [] : extractSpecifiedFields(parsedQuery);

    const defaultFields = options?.onlyFields
      ? []
      : this.getFields(this.childCollection, Boolean(options?.extended));

    const searchableFields = new Map(
      [
        ...defaultFields,
        ...[...specifiedFields, ...(options?.onlyFields ?? []), ...(options?.includeFields ?? [])]
          .map(name => this.lenientGetSchema(name))
          .filter(Boolean)
          .map(schema => [schema.field, schema.schema] as [string, ColumnSchema]),
      ]
        .filter(Boolean)
        .filter(([field]) => !options?.excludeFields?.includes(field)),
    );

    const conditionTree = generateConditionTree(caller, parsedQuery, [...searchableFields]);

    if (!conditionTree && searchText.trim().length) {
      return ConditionTreeFactory.MatchNone;
    }

    return conditionTree;
  }

  private generatePlainSearchFilter(
    caller: Caller,
    searchText: string,
    options?: SearchOptions,
  ): PlainConditionTree {
    const conditionTree = this.generateSearchFilter(caller, searchText, options);

    return conditionTree?.toPlainObject();
  }

  private getFields(collection: Collection, extended: boolean): [string, ColumnSchema][] {
    const fields: [string, ColumnSchema][] = [];

    for (const [name, field] of Object.entries(collection.schema.fields)) {
      if (field.type === 'Column') fields.push([name, field]);

      if (extended && (field.type === 'ManyToOne' || field.type === 'OneToOne')) {
        const related = collection.dataSource.getCollection(field.foreignCollection);

        for (const [subName, subField] of Object.entries(related.schema.fields)) {
          if (subField.type === 'Column') fields.push([`${name}:${subName}`, subField]);
        }
      }
    }

    return fields;
  }

  private lenientGetSchema(path: string): { field: string; schema: ColumnSchema } | null {
    const [prefix, suffix] = path.split(/:(.*)/);
    const fuzzyPrefix = normalizeName(prefix);

    for (const [field, schema] of Object.entries(this.schema.fields)) {
      const fuzzyFieldName = normalizeName(field);

      if (fuzzyPrefix === fuzzyFieldName) {
        if (!suffix && schema.type === 'Column') {
          return { field, schema };
        }

        if (
          suffix &&
          (schema.type === 'OneToMany' || schema.type === 'ManyToOne' || schema.type === 'OneToOne')
        ) {
          const related = this.dataSource.getCollection(schema.foreignCollection);
          const fuzzy = related.lenientGetSchema(suffix);

          if (fuzzy) return { field: `${field}:${fuzzy.field}`, schema: fuzzy.schema };
        }
      }
    }

    return null;
  }
}
