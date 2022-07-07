import { AbstractDataType, AbstractDataTypeConstructor, ColumnDescription } from 'sequelize';
import { QueryInterface } from 'sequelize/types/dialects/abstract/query-interface';

export type FieldDescription = (
  | string
  | (Omit<ColumnDescription, 'defaultValue' | 'type'> & {
      defaultValue: unknown;
      type: AbstractDataType | AbstractDataTypeConstructor;
    })
)[];

export type ForeignKeyReference = Awaited<
  ReturnType<QueryInterface['getForeignKeyReferencesForTable']>
>[number];
