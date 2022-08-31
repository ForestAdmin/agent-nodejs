import { AbstractDataType, AbstractDataTypeConstructor, ColumnDescription } from 'sequelize';
import { DataSource, Logger } from '@forestadmin/datasource-toolkit';
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

export type Model = {
  name: string;
  associations: unknown;
  getAttributes: () => unknown;
};

export interface Builder {
  defineModel(tableName: string): Promise<void>;
  defineRelation(tableName: string): Promise<void>;
  getRelatedTables(tableName: string): Promise<string[]>;
  buildDataSource(): DataSource;
  getTableNames(): Promise<string[]>;
  logger?: Logger;
  models: { [modelName: string]: Model };
}
