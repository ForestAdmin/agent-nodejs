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
} from '../../index';
import ConditionTreeUtils from '../../utils/condition-tree';
import TypeGetterUtil from '../../utils/type-checker';

export default class SearchCollectionDecorator extends CollectionDecorator {
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
    const searchType = TypeGetterUtil.get(searchString);
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
    } else if (PrimitiveTypes.Number === columnType && searchType === PrimitiveTypes.Number) {
      condition = { field, operator: Operator.Equal, value: Number(searchString) };
    } else if (PrimitiveTypes.Uuid === columnType && searchType === PrimitiveTypes.Uuid) {
      condition = { field, operator: Operator.Equal, value: searchString };
    } else if (PrimitiveTypes.String === columnType && searchType === PrimitiveTypes.String) {
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

    if (searchExtended) SearchCollectionDecorator.getDeepFields(dataSource, fields);

    return fields.filter(([, fieldSchema]) =>
      SearchCollectionDecorator.isSearchable(fieldSchema),
    ) as [string, ColumnSchema][];
  }

  private static getDeepFields(dataSource: DataSource, fields: [string, FieldSchema][]) {
    fields.forEach(([name, field]) => {
      if (field.type === FieldTypes.ManyToOne || field.type === FieldTypes.OneToOne) {
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
