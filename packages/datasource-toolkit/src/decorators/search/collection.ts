import CollectionDecorator from '../CollectionDecorator';
import {
  Aggregator,
  CollectionSchema,
  ColumnSchema,
  ConditionTree,
  DataSource,
  FieldSchema,
  FieldTypes,
  Filter,
  Operator,
  PrimitiveTypes,
  RelationSchema,
} from '../../index';
import ConditionTreeUtils from '../../utils/condition-tree';

export default class SearchCollectionDecorator extends CollectionDecorator {
  private static readonly REGEX_V3_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  public refineFilter(filter: Filter): Filter {
    let { conditionTree, search } = filter;

    if (search && !this.collection.schema.searchable) {
      if (SearchCollectionDecorator.checkEmptyString(search)) {
        return { ...filter, search: null };
      }

      const searchFields = SearchCollectionDecorator.getSearchFields(
        this.collection.schema,
        this.collection.dataSource,
        filter.deepSearch,
      );
      const conditions = searchFields
        .map(([field, schema]) =>
          SearchCollectionDecorator.buildCondition(field, schema, filter.search),
        )
        .filter(Boolean);

      // Note that if not fields are searchable with the provided searchString, the conditions
      // array might be empty, which will create a condition returning zero records
      // (this is the desired behavior).
      const searchFilter = { aggregator: Aggregator.Or, conditions };
      conditionTree = ConditionTreeUtils.buildConditionsTree(conditionTree, searchFilter);

      search = null;

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

    if (
      PrimitiveTypes.Enum === columnType &&
      SearchCollectionDecorator.getEnumValue(enumValues, searchString)
    ) {
      return {
        field,
        operator: Operator.Equal,
        value: SearchCollectionDecorator.getEnumValue(enumValues, searchString),
      };
    }

    if (PrimitiveTypes.Number === columnType && searchType === 'number') {
      return { field, operator: Operator.Equal, value: Number(searchString) };
    }

    if (PrimitiveTypes.Uuid === columnType && searchType === 'uuid') {
      return { field, operator: Operator.Equal, value: searchString };
    }

    if (PrimitiveTypes.String === columnType && searchType === 'string') {
      return { field, operator: Operator.Contains, value: searchString };
    }

    return null;
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
    deepSearch: boolean,
  ): [string, ColumnSchema][] {
    const fields = Object.entries(schema.fields);

    if (deepSearch) this.getDeepFields(dataSource, fields);

    return fields.filter(([, fieldSchema]) =>
      SearchCollectionDecorator.isSearchable(fieldSchema),
    ) as [string, ColumnSchema][];
  }

  private static getDeepFields(
    dataSource: DataSource,
    fields: [string, ColumnSchema | RelationSchema][],
  ) {
    fields.forEach(([name, field]) => {
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

  private static checkEmptyString(searchString: string) {
    return searchString.trim().length === 0;
  }

  private static getSearchType(searchString: string): 'number' | 'string' | 'uuid' {
    if (searchString.match(SearchCollectionDecorator.REGEX_V3_UUID)) {
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
