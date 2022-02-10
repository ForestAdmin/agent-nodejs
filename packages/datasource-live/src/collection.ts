import { AbstractDataTypeConstructor, ModelDefined } from 'sequelize';

import {
  AggregateResult,
  Aggregation,
  CollectionSchema,
  ColumnSchema,
  CompositeId,
  DataSource,
  FieldTypes,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { SequelizeCollection, TypeConverter } from '@forestadmin/datasource-sequelize';

export default class LiveCollection extends SequelizeCollection {
  private synched = false;

  constructor(
    name: string,
    dataSource: DataSource,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: ModelDefined<any, any>,
    schema?: CollectionSchema,
  ) {
    super(name, dataSource, model);

    if (schema) {
      if (schema.searchable) this.enableSearch();

      this.extendSchemaWithFilterOperators(schema, model);
    }
  }

  private ensureSynched(): void {
    if (!this.synched) {
      throw new Error(`Collection "${this.name}" is not synched yet. Call "sync" first.`);
    }
  }

  private extendSchemaWithFilterOperators(
    schema: CollectionSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: ModelDefined<any, any>,
  ) {
    Object.entries(schema.fields).forEach(([fieldName, field]) => {
      if (field.type !== FieldTypes.Column) return;

      const columnSchema = field as ColumnSchema;

      if ([null, undefined].includes(columnSchema.filterOperators)) {
        field.filterOperators = TypeConverter.operatorsForDataType(
          model.getAttributes()[fieldName].type as AbstractDataTypeConstructor,
        );
      }
    });
  }

  async sync(): Promise<boolean> {
    this.synched = false;

    await this.model.sync({ force: true });
    this.synched = true;

    return true;
  }

  override getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    this.ensureSynched();

    return super.getById(id, projection);
  }

  override create(data: RecordData[]): Promise<RecordData[]> {
    this.ensureSynched();

    return super.create(data);
  }

  override list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    this.ensureSynched();

    return super.list(filter, projection);
  }

  override update(filter: Filter, patch: RecordData): Promise<void> {
    this.ensureSynched();

    return super.update(filter, patch);
  }

  override delete(filter: Filter): Promise<void> {
    this.ensureSynched();

    return super.delete(filter);
  }

  override aggregate(
    filter: PaginatedFilter,
    aggregation: Aggregation,
  ): Promise<AggregateResult[]> {
    this.ensureSynched();

    return super.aggregate(filter, aggregation);
  }
}
