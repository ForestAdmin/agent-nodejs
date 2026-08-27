import type { SearchOptions } from './collection-search-context';
import type { QueryContext } from './generated-parser/QueryParser';
import type {
  SearchFieldsDefinition,
  SearchHandlerDefinition,
  SearchReplaceDefinition,
} from './types';
import type {
  Caller,
  Collection,
  CollectionSchema,
  ColumnSchema,
  ConditionTree,
  DataSourceDecorator,
  PaginatedFilter,
  PlainConditionTree,
  SearchedField,
} from '@forestadmin/datasource-toolkit';

import { CollectionDecorator, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';

import CollectionSearchContext from './collection-search-context';
import { getLeafCollectionName, lenientGetSchema } from './field-paths';
import { extractSpecifiedFields, generateConditionTree, parseQuery } from './parse-query';

export default class SearchCollectionDecorator extends CollectionDecorator {
  override dataSource: DataSourceDecorator<SearchCollectionDecorator>;
  replacer: SearchReplaceDefinition = null;
  searchable = true;

  replaceSearch(replacer: SearchReplaceDefinition): void {
    this.searchable = true;
    this.replacer = replacer;
    this.markSchemaAsDirty();
  }

  private get handler(): SearchHandlerDefinition | null {
    return typeof this.replacer === 'function' ? this.replacer : null;
  }

  private get fieldSelection(): SearchFieldsDefinition | null {
    return this.replacer && typeof this.replacer !== 'function' ? this.replacer : null;
  }

  disable() {
    this.searchable = false;
    this.markSchemaAsDirty();
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

      if (this.handler) {
        const plainTree = await this.handler(filter.search, filter.searchExtended, ctx);
        tree = ConditionTreeFactory.fromPlainObject(plainTree);
      } else {
        tree = this.generateSearchFilter(caller, filter.search, {
          ...this.fieldSelection,
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

  /**
   * Both the condition tree and the footprint `getSearchedFields` reports must come from here:
   * a path the search reads without appearing in the footprint is a column read unchecked.
   */
  private getSearchableFields(
    parsedQuery: QueryContext,
    options?: SearchOptions,
  ): Map<string, ColumnSchema> {
    const specifiedFields = options?.onlyFields ? [] : extractSpecifiedFields(parsedQuery);

    const defaultFields = options?.onlyFields
      ? []
      : this.getFields(this.childCollection, Boolean(options?.extended));

    // Resolved the same way the included ones are, or `excludeFields: ['panLast4']` would silently
    // fail to drop a `pan_last4` column that `includeFields` resolves. An unresolvable name is kept
    // as written: it excludes nothing either way.
    const excludedFields = new Set(
      (options?.excludeFields ?? []).map(name => lenientGetSchema(this, name)?.field ?? name),
    );

    return new Map(
      [
        ...defaultFields,
        ...[...specifiedFields, ...(options?.onlyFields ?? []), ...(options?.includeFields ?? [])]
          .map(name => lenientGetSchema(this, name))
          .filter(Boolean)
          .map(schema => [schema.field, schema.schema] as [string, ColumnSchema]),
      ]
        .filter(Boolean)
        .filter(([field]) => !excludedFields.has(field)),
    );
  }

  private generateSearchFilter(
    caller: Caller,
    searchText: string,
    options?: SearchOptions,
  ): ConditionTree {
    const parsedQuery = parseQuery(searchText);
    const searchableFields = this.getSearchableFields(parsedQuery, options);

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

  /**
   * Answers against `childCollection`, which is what the search actually reads — a field hidden by
   * the publication or renaming layers above is still searched. Returns `null` only when a handler
   * is installed: it chooses the fields, and the caller only supplies the text.
   */
  override getSearchedFields(search: string, extended: boolean): SearchedField[] | null {
    if (this.handler) return null;

    const paths = [
      ...this.getSearchableFields(parseQuery(search), { ...this.fieldSelection, extended }).keys(),
    ];

    return paths.map(path => ({
      path,
      collection: getLeafCollectionName(this.childCollection, path),
    }));
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
}
