import CollectionDecorator from '../CollectionDecorator';
import {
  Aggregator,
  CollectionSchema,
  ColumnSchema,
  ConditionTree,
  Filter,
  Operator,
  FieldTypes,
  DataSource,
  FieldSchema,
} from '../../index';
import ConditionTreeUtils from '../../utils/condition-tree';
import { PrimitiveTypes } from '../../interfaces/schema';

export default class SearchCollectionDecorator extends CollectionDecorator {
  private static readonly REGEX_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  public refineFilter(filter: Filter): Filter {
    let { conditionTree, search } = filter;

    if (search && !this.collection.schema.searchable) {
      if (SearchCollectionDecorator.getSearchType(search) === 'none') {
        return { ...filter, search: null };
      }

      const searchFields = SearchCollectionDecorator.getSearchFields(
        this.collection.schema,
        this.collection.dataSource,
        filter.searchExtended,
      );
      const conditions = searchFields
        .map(([field, schema]) =>
          SearchCollectionDecorator.buildCondition(field, schema, filter.search),
        )
        .filter(Boolean);

      search = null;

      // Note that if not fields are searchable with the provided searchString, the conditions
      // array might be empty, which will create a condition returning zero records
      // (this is the desired behavior).
      const searchFilter = { aggregator: Aggregator.Or, conditions };
      conditionTree = ConditionTreeUtils.addConditionsTree(conditionTree, searchFilter);

      return { ...filter, conditionTree, search };
    }

    return filter;
  }

  private static buildCondition(
    field: string,
    schema: ColumnSchema,
    searchString: string,
  ): ConditionTree {
    const searchType = SearchCollectionDecorator.getSearchType(searchString);
    const { columnType, enumValues } = schema;

    switch (columnType) {
      case PrimitiveTypes.Enum:
        // Enums can be searched in a case-insensitive way
        // a ' active' search string should match all record with the 'ACTIVE' enum value.
        return SearchCollectionDecorator.getEnumValue(enumValues, searchString)
          ? {
              field,
              operator: Operator.Equal,
              value: SearchCollectionDecorator.getEnumValue(enumValues, searchString),
            }
          : null;

      case PrimitiveTypes.Number:
        // When searching on number fields, we expect exact matches (a '12' search string should
        // not match on a record containing 3123)
        return searchType === 'number' 
          ? { field, operator: Operator.Equal, value: Number(searchString) }
          : null;

      case PrimitiveTypes.Uuid:
        // Like numbers, uuids are exact matches (this prevents postgres drivers from complaining)
        return searchType === 'uuid'
          ? { field, operator: Operator.Equal, value: searchString }
          : null;
      default:
        // String case
        // String are always be searched with the 'contains' operator.
        return searchType !== 'none'
          ? { field, operator: Operator.Contains, value: searchString }
          : null;
    }
  }

  private static getEnumValue(enumValues: string[], searchString: string): string {
    return (
      enumValues &&
      enumValues.find(
        enumValue => enumValue.toLocaleLowerCase() === searchString.toLocaleLowerCase().trim(),
      )
    );
  }

  private static getSearchFields(
    schema: CollectionSchema,
    dataSource: DataSource,
    extended: boolean,
  ): [string, ColumnSchema][] {
    const fields = Object.entries(schema.fields);

    if (extended) {
      Object.entries(schema.fields).forEach(([name, field]) => {
        if (field.type !== FieldTypes.Column) {
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

    return fields.filter(([, fieldSchema]) =>
      SearchCollectionDecorator.isSearchable(fieldSchema),
    ) as [string, ColumnSchema][];
  }

  private static getSearchType(searchString: string): 'none' | 'number' | 'string' | 'uuid' {
    if (searchString.trim().length === 0) {
      return 'none';
    }

    if (searchString.match(SearchCollectionDecorator.REGEX_UUID)) {
      return 'uuid';
    }

    if (!Number.isNaN(Number(searchString)) && !Number.isNaN(parseFloat(searchString))) {
      // @see https://stackoverflow.com/questions/175739
      return 'number';
    }

    return 'string';
  }

  private static isSearchable(schema: FieldSchema): boolean {
    if (schema.type !== FieldTypes.Column) {
      return false;
    }

    const { columnType } = schema;

    return (
      columnType === PrimitiveTypes.Enum ||
      columnType === PrimitiveTypes.Number ||
      columnType === PrimitiveTypes.String ||
      columnType === PrimitiveTypes.Uuid
    );
  }
}
