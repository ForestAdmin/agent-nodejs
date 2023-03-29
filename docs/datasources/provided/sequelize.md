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
One way to overcome this restriction is to utilize the `castUuidToString` option for the data source, which disables UUID type verification and transforms UUIDs into strings.
Despite this conversion, your database will continue to store UUIDs rather than strings, so there is no need for concern.

```javascript
/* ... */
const agent = createAgent(options).addDataSource(
  createSequelizeDataSource(sequelize, { castUuidToString: true }),
);
```
