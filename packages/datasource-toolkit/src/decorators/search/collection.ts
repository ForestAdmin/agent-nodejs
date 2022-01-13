import CollectionDecorator from '../collection-decorator';
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

enum SearchType {
  String,
  Number,
  Uuid,
}

export default class SearchCollectionDecorator extends CollectionDecorator {
  private static readonly REGEX_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  public override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return { ...subSchema, searchable: true };
  }

  public override refineFilter(filter?: Filter): Filter {
    if (filter?.search && !this.childCollection.schema.searchable) {
      let { conditionTree, search } = filter;

      if (SearchCollectionDecorator.checkEmptyString(search)) {
        return { ...filter, search: null };
      }

      const searchFields = SearchCollectionDecorator.getSearchFields(
        this.childCollection.schema,
        this.childCollection.dataSource,
        filter.searchExtended,
      );
      const conditions = searchFields
        .map(([field, schema]) => SearchCollectionDecorator.buildCondition(field, schema, search))
        .filter(Boolean);

      // Note that if not fields are searchable with the provided searchString, the conditions
      // array might be empty, which will create a condition returning zero records
      // (this is the desired behavior).
      const searchFilter = { aggregator: Aggregator.Or, conditions };
      conditionTree = ConditionTreeUtils.intersect(conditionTree, searchFilter);

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
    let condition = null;

    if (
      PrimitiveTypes.Enum === columnType &&
      SearchCollectionDecorator.getEnumValue(enumValues, searchString)
    ) {
      condition = {
        field,
        operator: Operator.Equal,
        value: SearchCollectionDecorator.getEnumValue(enumValues, searchString),
      };
    } else if (PrimitiveTypes.Number === columnType && searchType === SearchType.Number) {
      condition = { field, operator: Operator.Equal, value: Number(searchString) };
    } else if (PrimitiveTypes.Uuid === columnType && searchType === SearchType.Uuid) {
      condition = { field, operator: Operator.Equal, value: searchString };
    } else if (PrimitiveTypes.String === columnType && searchType === SearchType.String) {
      condition = { field, operator: Operator.Contains, value: searchString };
    }

    return condition;
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
    searchExtended: boolean,
  ): [string, ColumnSchema][] {
    const fields = Object.entries(schema.fields);

    if (searchExtended) this.getDeepFields(dataSource, fields);

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

  private static getSearchType(searchString: string): SearchType {
    if (searchString.match(SearchCollectionDecorator.REGEX_UUID)) {
      return SearchType.Uuid;
    }

    if (!Number.isNaN(Number(searchString)) && !Number.isNaN(parseFloat(searchString))) {
      // @see https://stackoverflow.com/questions/175739
      return SearchType.Number;
    }

    return SearchType.String;
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
