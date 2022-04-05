import {
  ColumnType,
  ComputedContext,
  Operator,
  OperatorReplacer,
  RecordData,
  SortClause,
} from '@forestadmin/datasource-toolkit';

export type FieldDefinition = {
  beforeRelations?: boolean;
  columnType: ColumnType;
  dependencies: string[];
  isRequired?: boolean;
  defaultValue?: unknown;
  enumValues?: string[];

  getValues(records: RecordData[], context: ComputedContext): Promise<unknown[]> | unknown[];

  sortBy?: 'emulate' | SortClause[];
  filterBy?: 'emulate' | Partial<Record<Operator, 'emulate' | OperatorReplacer>>;
};
