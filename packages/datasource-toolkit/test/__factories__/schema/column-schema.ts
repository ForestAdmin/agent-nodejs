import { Factory } from 'fishery';
import { ColumnSchema, FieldTypes, PrimitiveTypes } from '../../../src/interfaces/schema';

export default Factory.define<ColumnSchema>(() => ({
  type: FieldTypes.Column,
  columnType: PrimitiveTypes.String,
  filterOperators: new Set(),
}));
