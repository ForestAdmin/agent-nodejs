import { DataSource } from '../../interfaces/collection';
import ConditionTree from '../../interfaces/query/condition-tree/nodes/base';
import ConditionTreeLeaf, { Operator } from '../../interfaces/query/condition-tree/nodes/leaf';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import {
  CollectionSchema,
  ColumnSchema,
  FieldSchema,
  FieldTypes,
  PrimitiveTypes,
} from '../../interfaces/schema';
import ConditionTreeFactory from '../../interfaces/query/condition-tree/factory';
import TypeGetter from '../../validation/type-getter';
import CollectionDecorator from '../collection-decorator';

export default class SearchCollectionDecorator extends CollectionDecorator {
  public override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return { ...subSchema, searchable: true };
  }

  public override async refineFilter(filter?: PaginatedFilter): Promise<PaginatedFilter> {
    if (!filter?.search || this.childCollection.schema.searchable) {
      return filter;
    }

    if (SearchCollectionDecorator.checkEmptyString(filter.search)) {
      return filter.override({ search: null });
    }

    const searchableFields = SearchCollectionDecorator.getSearchFields(
      this.childCollection.schema,
      this.childCollection.dataSource,
      filter.searchExtended,
    );

    const conditions = searchableFields
      .map(([field, schema]) =>
        SearchCollectionDecorator.buildCondition(field, schema, filter.search),
      )
      .filter(Boolean);

    // Note that if not fields are searchable with the provided searchString, the conditions
    // array might be empty, which will create a condition returning zero records
    // (this is the desired behavior).
    return filter.override({
      conditionTree: ConditionTreeFactory.intersect(
        filter.conditionTree,
        ConditionTreeFactory.union(...conditions),
      ),
      search: null,
    });
  }

  private static buildCondition(
    field: string,
    schema: ColumnSchema,
    searchString: string,
  ): ConditionTree {
    const searchType = TypeGetter.get(searchString);
    const { columnType, enumValues } = schema;
    let condition: ConditionTree = null;

    if (
      PrimitiveTypes.Enum === columnType &&
      SearchCollectionDecorator.getEnumValue(enumValues, searchString)
    ) {
      condition = new ConditionTreeLeaf(
        field,
        Operator.Equal,
        SearchCollectionDecorator.getEnumValue(enumValues, searchString),
      );
    } else if (PrimitiveTypes.Number === columnType && searchType === PrimitiveTypes.Number) {
      condition = new ConditionTreeLeaf(field, Operator.Equal, Number(searchString));
    } else if (PrimitiveTypes.Uuid === columnType && searchType === PrimitiveTypes.Uuid) {
      condition = new ConditionTreeLeaf(field, Operator.Equal, searchString);
    } else if (PrimitiveTypes.String === columnType && searchType === PrimitiveTypes.String) {
      condition = new ConditionTreeLeaf(field, Operator.Contains, searchString);
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
    if (schema.type === FieldTypes.Column) {
      const { columnType, filterOperators } = schema;

      if (
        columnType === PrimitiveTypes.Enum ||
        columnType === PrimitiveTypes.Number ||
        columnType === PrimitiveTypes.Uuid
      ) {
        return filterOperators?.has(Operator.Equal);
      }

      if (columnType === PrimitiveTypes.String) {
        return filterOperators?.has(Operator.Contains);
      }
    }

    return false;
  }
}
