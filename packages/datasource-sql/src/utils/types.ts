import { AbstractDataType, AbstractDataTypeConstructor, ColumnDescription } from 'sequelize';
import { DataSource } from '@forestadmin/datasource-toolkit';
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

export interface Orm {
  defineModels(): Promise<void>;
  defineRelations(): Promise<void>;
  definedCollections(): void;
  models: { [modelName: string]: Model };
  getDataSource: () => DataSource;
}
