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

Postgres UUID columns accept [non-standard UUIDs](https://www.postgresql.org/docs/current/datatype-uuid.html) which don't pass Forest Admin validation rules.

To overcome this restriction set the `castUuidToString` option to `true`. It will tell your agent to handle all `UUIDs` coming from Postgres as simple `strings`.

This won't change how data is saved into your database.

```javascript
/* ... */
const agent = createAgent(options).addDataSource(
  createSequelizeDataSource(sequelize, { castUuidToString: true }),
);
```
