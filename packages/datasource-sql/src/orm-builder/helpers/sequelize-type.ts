import { DataTypes } from 'sequelize';

import { ColumnType, SequelizeColumnType } from '../../introspection/types';

export default class SequelizeTypeFactory {
  static makeSequelizeType(type: ColumnType): SequelizeColumnType {
    switch (type.type) {
      case 'scalar':
        if (DataTypes[type.subType]) return DataTypes[type.subType];
        throw new Error(`Unexpected type: ${type.subType}`);

      case 'enum':
        return DataTypes.ENUM(...type.values);

      case 'array':
        return DataTypes.ARRAY(this.makeSequelizeType(type.subType));

      default:
        throw new Error();
    }
  }
}
