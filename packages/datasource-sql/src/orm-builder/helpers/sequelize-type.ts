/* eslint-disable max-len */
/* eslint-disable max-classes-per-file */
import { DataTypes } from 'sequelize';

import { ColumnType, SequelizeColumnType } from '../../introspection/types';

export default class SequelizeTypeFactory {
  static makeSequelizeType(type: ColumnType): SequelizeColumnType {
    switch (type.type) {
      case 'scalar':
        if (DataTypes[type.subType]) return DataTypes[type.subType];
        throw new Error(`Unexpected type: ${type.subType}`);

      case 'enum':
        return type.name
          ? this.makeCustomEnumType(type.name, type.values)
          : DataTypes.ENUM(...type.values);

      case 'array':
        return DataTypes.ARRAY(this.makeSequelizeType(type.subType));

      default:
        throw new Error();
    }
  }

  /**
   * This workaround is needed because when inserting records in a table with an Array<Enum> column,
   * sequelize will try to cast the value to the enum type.
   *
   * This will fail if the database that sequelize is connected to was not initially created by
   * sequelize, because the enum type is unlikely to have the name that sequelize expects.
   *
   * @see https://community.forestadmin.com/t/postgresql-enum-type-does-not-exist-error-wrong-enum-type-name/5931
   * @see https://github.com/sequelize/sequelize/blob/v6.28.0/src/dialects/postgres/data-types.js#L491
   * @see https://github.com/sequelize/sequelize/blob/v6.28.0/src/utils.js#L555
   */
  private static makeCustomEnumType(name: string, values: string[]): SequelizeColumnType {
    const Type = class extends DataTypes.ABSTRACT {
      // Markers to tell @forestadmin/datasource-sequelize to consider this type as an enum
      // when transforming sequelize models to forest collections.
      // Otherwise, we would get the "Skipping column" error
      static readonly isEnum = true;
      readonly isEnum = true;

      // Setting this tells sequelize the name of the type in the database.
      // This is used, most notably, when casting values (which happens when the enum is used in
      // arrays)
      static override key = name;
      override key = name;

      // The rest is more or less copy pasted from the sequelize source code of the ENUM type.
      // Hopefully that won't change too much when sequelize 7 is released.
      values: string[];
      options: { values: string[] };

      constructor() {
        super();

        this.values = values;
        this.options = { values };
      }

      // Steal the validate method from the ENUM type
      validate = DataTypes.ENUM.prototype.validate;
    };

    return new Type();
  }
}
