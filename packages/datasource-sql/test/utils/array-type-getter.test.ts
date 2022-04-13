import { DataTypes, Sequelize } from 'sequelize';
import ArrayTypeGetter from '../../src/utils/array-type-getter';

describe('ArrayTypeGetter', () => {
  it('should return arrayType', async () => {
    const sequelize = new Sequelize('postgres://test:password@localhost:5443/test', {
      logging: false,
    });

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

    await sequelize.close();

    expect(typeInt).toStrictEqual({ type: 'INTEGER', special: [] });
    expect(typeString).toStrictEqual({ type: 'CHARACTER VARYING', special: [] });
    expect(typeEnum).toStrictEqual({ type: 'USER-DEFINED', special: ['enum1', 'enum2'] });
  });
});
