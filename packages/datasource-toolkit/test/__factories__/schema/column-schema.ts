import { Factory } from 'fishery';

import { ColumnSchema, FieldTypes, PrimitiveTypes } from '../../../src/interfaces/schema';
import { Operator } from '../../../src/interfaces/query/condition-tree/nodes/leaf';

export class ColumnSchemaFactory extends Factory<ColumnSchema> {
  isPrimaryKey(): ColumnSchemaFactory {
    return this.params({
      isPrimaryKey: true,
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Uuid,
      filterOperators: new Set([Operator.Equal, Operator.In]),
    });
  }
}

export default ColumnSchemaFactory.define(() => ({
  type: FieldTypes.Column as FieldTypes.Column,
  columnType: PrimitiveTypes.String,
  filterOperators: new Set(Object.values(Operator)),
}));
