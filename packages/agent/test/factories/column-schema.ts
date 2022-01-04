import { Factory } from 'fishery';
import { ColumnSchema, FieldTypes, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

export default Factory.define<ColumnSchema>(() => ({
  type: FieldTypes.Column,
  columnType: PrimitiveTypes.String,
  filterOperators: new Set(),
}));
