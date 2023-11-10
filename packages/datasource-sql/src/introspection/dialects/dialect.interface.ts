import { Sequelize } from 'sequelize';

import { SequelizeColumn, SequelizeTableIdentifier } from '../type-overrides';

export type ColumnDescription = SequelizeColumn & {
  name: string;
  isLiteralDefaultValue: boolean;
};

export default interface IntrospectionDialect {
  listColumns(
    tableNames: SequelizeTableIdentifier[],
    sequelize: Sequelize,
  ): Promise<ColumnDescription[][]>;
}
