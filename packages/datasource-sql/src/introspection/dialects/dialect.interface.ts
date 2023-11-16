import { Sequelize } from 'sequelize';

import { SequelizeColumn, SequelizeTableIdentifier } from '../type-overrides';

export type ColumnDescription = SequelizeColumn & {
  name: string;
  isLiteralDefaultValue: boolean;
  enumValues: string[];
};

export default interface IntrospectionDialect {
  listColumns(
    tableNames: SequelizeTableIdentifier[],
    sequelize: Sequelize,
  ): Promise<ColumnDescription[][]>;
}
