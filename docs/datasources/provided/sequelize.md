The sequelize data source allows importing collections from a sequelize instance.

To make everything work as expected, you need to install the package `@forestadmin/datasource-sequelize`.

Note that:

- Sequelize scopes will be mapped to Forest Admin segments
- Sequelize hooks will run
- Sequelize association, field aliasing, relationships, and validation will be respected

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSequelizeDataSource } = require('@forestadmin/datasource-sequelize');
const { Sequelize, Model, DataTypes } = require('@sequelize/core');

// Create a sequelize instance
const sequelize = new Sequelize('sqlite::memory:');

class User extends Model {}
User.init(
  {
    username: DataTypes.STRING,
    birthday: DataTypes.DATE,
  },
  { sequelize, modelName: 'user' },
);

// Create agent and import collections from sequelize
const agent = createAgent(options).addDataSource(createSequelizeDataSource(sequelize));
```

# Disable UUID type checking

[Postgres UUID type support non-standard UUIDs](https://www.postgresql.org/docs/current/datatype-uuid.html) but forestadmin-agent does not support it.
To bypass this limitation, you can disable the UUID type checking by giving the `castUuidToString` option to the data source.

```javascript
/* ... */
const agent = createAgent(options).addDataSource(
  createSequelizeDataSource(sequelize, { castUuidToString: true }),
);
```
