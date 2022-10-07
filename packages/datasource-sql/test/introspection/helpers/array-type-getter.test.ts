import { DataTypes, Sequelize } from 'sequelize';

import ArrayTypeGetter from '../../../src/introspection/helpers/array-type-getter';

describe('ArrayTypeGetter', () => {
  it('should return arrayType', async () => {
    let sequelize: Sequelize | null = null;

    try {
      const database = 'datasource-sql-array-type-getter-test';
      let connectionUri = `postgres://test:password@localhost:5443`;
      sequelize = new Sequelize(connectionUri, { logging: false });
      await sequelize.getQueryInterface().dropDatabase(database);
      await sequelize.getQueryInterface().createDatabase(database);
      await sequelize.close();

      connectionUri = `${connectionUri}/${database}`;
      sequelize = new Sequelize(connectionUri, { logging: false });

      sequelize.define(
        'arrayTable',
        {
          arrayInt: DataTypes.ARRAY(DataTypes.INTEGER),
          arrayString: DataTypes.ARRAY(DataTypes.STRING),
          arrayEnum: DataTypes.ARRAY(DataTypes.ENUM('enum1', 'enum2')),
        },
        { tableName: 'arrayTable' },
      );

      await sequelize.sync({ force: true });

      const arrayTypeGetter = new ArrayTypeGetter(sequelize);

      const typeInt = await arrayTypeGetter.getType('arrayTable', 'arrayInt');
      const typeString = await arrayTypeGetter.getType('arrayTable', 'arrayString');
      const typeEnum = await arrayTypeGetter.getType('arrayTable', 'arrayEnum');

      expect(typeInt).toStrictEqual({ type: 'INTEGER', special: [] });
      expect(typeString).toStrictEqual({ type: 'CHARACTER VARYING', special: [] });
      expect(typeEnum).toStrictEqual({ type: 'USER-DEFINED', special: ['enum1', 'enum2'] });
    } finally {
      await sequelize?.close();
    }
  });
});
