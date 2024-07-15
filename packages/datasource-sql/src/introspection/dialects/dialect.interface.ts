import { Sequelize } from 'sequelize';

import { SequelizeColumn, SequelizeTableIdentifier } from '../type-overrides';

export type ColumnDescription = Omit<SequelizeColumn, 'defaultValue'> & {
  name: string;
  isLiteralDefaultValue: boolean;
  enumValues: string[] | null;
  defaultValue: string | null;
};

export default interface IntrospectionDialect {
  listColumns(
    tableNames: SequelizeTableIdentifier[],
    sequelize: Sequelize,
  ): Promise<ColumnDescription[][]>;

  listViews(sequelize: Sequelize): Promise<SequelizeTableIdentifier[]>;

  getDefaultSchema(sequelize: Sequelize): string;
  getTableIdentifier(tableIdentifier: SequelizeTableIdentifier): SequelizeTableIdentifier;
}
