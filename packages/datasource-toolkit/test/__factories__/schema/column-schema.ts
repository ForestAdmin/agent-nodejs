import type { ColumnSchema } from '../../../src/interfaces/schema';

import { Factory } from 'fishery';

import { MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE } from '../../../src/validation/rules';

export class ColumnSchemaFactory extends Factory<ColumnSchema> {
  numericPrimaryKey(): ColumnSchemaFactory {
    return this.params({
      isPrimaryKey: true,
      type: 'Column',
      columnType: 'Number',
      isSortable: true,
      filterOperators: new Set(MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE.Number),
    });
  }

  uuidPrimaryKey(): ColumnSchemaFactory {
    return this.params({
      isPrimaryKey: true,
      type: 'Column',
      columnType: 'Uuid',
      isSortable: true,
      filterOperators: new Set(MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE.Uuid),
    });
  }

  text(): ColumnSchemaFactory {
    return this.params({
      type: 'Column',
      columnType: 'String',
      isSortable: true,
      filterOperators: new Set(MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE.String),
    });
  }
}

export default ColumnSchemaFactory.define(() => ({
  type: 'Column' as const,
  columnType: 'String' as const,
}));
