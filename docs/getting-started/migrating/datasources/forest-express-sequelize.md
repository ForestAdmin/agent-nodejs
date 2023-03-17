To connect your new agent to a SQL database, you have two options:

- Use the `Sequelize` ORM, like the old agent.
- Connect directly to the database using the `@forestadmin/datasource-sql` package.

The choice depends on your use case:

- Customers that have in-app installations and use the `Sequelize` ORM in their code will probably want to keep using it.
- Others that only used `Sequelize` because it was a requirement in the legacy agents will probably want to connect directly to their database and stop maintaining their `Sequelize` models.

# If you choose to keep using `Sequelize`

In that case, you will need to:

- Install the `@forestadmin/datasource-sequelize` package.
- Copy your `Sequelize` models to the new project.
- Use the `@forestadmin/datasource-sequelize` connector.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSequelizeDataSource } = require('@forestadmin/datasource-sequelize');
const sequelize = require('./sequelize-models');

// Create agent and import collections from sequelize
const agent = createAgent(options).addDataSource(createSequelizeDataSource(sequelize));
```

# If you choose to connect directly to the database

In that case, you will need to start with:

- Install the `@forestadmin/datasource-sql` package.
- Install one of the supported SQL drivers: `mariadb`, `tedious`, `mysql2`, `oracledb`, `pg` or `sqlite3`.
- Create a new connection to the same database as the old one.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

// Create agent and import collections from SQL database
const agent = createAgent(options).addDataSource(
  createSqlDataSource('postgres://user:pass@localhost:5432/myDatabase'),
);
```

Then, depending on your database structure, you may need to rename both your tables and columns: the new agent will use the same names as your database, but depending on your previous Sequelize configuration, your previous agent may have renamed all tables and fields to `camelCase`.

Renaming tables and fields can be done by following this example:

```javascript
// Convert snake_case to camelCase
const toCamelCase = name => name.replace(/(_\w)/g, k => k[1].toUpperCase());

const agent = createAgent(options)
  // If your collection names do not match between the old and new agent
  // you can rename them using the `rename` option of the `addDataSource` function.

  // Note that in your code, you will use the camelCase names.
  .addDataSource(createSqlDataSource('postgres://user:pass@localhost:5432/myDatabase'), {
    rename: name => name.replace(/(_\w)/g, k => k[1].toUpperCase()),
  })

  // If your field names do not match between the old and new agent
  // you can rename them using the `renameField` function on all fields.

  // Note unlike with collection names, which are renamed in the internal representation,
  // you will still need to use the unrenamed field names in your code.
  .use(async ds => {
    for (const collection of ds.collections)
      for (const field of Object.keys(collection.schema.fields))
        collection.renameField(field, field.toUpperCase());
  });
```
