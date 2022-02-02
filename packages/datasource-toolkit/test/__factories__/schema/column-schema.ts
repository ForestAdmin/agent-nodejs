import { Factory } from 'fishery';
import { ColumnSchema, FieldTypes, PrimitiveTypes } from '../../../dist/interfaces/schema';
import { Operator } from '../../../dist/interfaces/query/condition-tree/leaf';

export class ColumnSchemaFactory extends Factory<ColumnSchema> {
  isPrimaryKey(): ColumnSchemaFactory {
    return this.params({
      isPrimaryKey: true,
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Uuid,
    });
  }
}

export default ColumnSchemaFactory.define(() => ({
  type: FieldTypes.Column as FieldTypes.Column,
  columnType: PrimitiveTypes.String,
  filterOperators: new Set() as Set<Operator>,
}));
