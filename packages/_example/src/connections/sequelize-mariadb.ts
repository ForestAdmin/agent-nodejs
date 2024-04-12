import { DataTypes, Sequelize } from 'sequelize';

const uri = 'mariadb://example:password@localhost:3808/example';
const sequelize = new Sequelize(uri, { logging: false });

const card = sequelize.define(
  'card',
  {
    cardNumber: {
      type: DataTypes.BIGINT,
      defaultValue: 1111222233334444,
    },
    cardType: {
      type: DataTypes.ENUM('visa', 'mastercard', 'american express'),
      defaultValue: 'visa',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    underscored: true,
    tableName: 'card',
    timestamps: false,
  },
);

const customer = sequelize.define(
  'customer',
  {
    name: {
      type: DataTypes.STRING,
      defaultValue: 'customer#',
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: 'customer',
    paranoid: true,
    timestamps: true,
  },
);

card.belongsTo(customer);
customer.hasMany(card);

export default sequelize;
