If you are migrating a datasource

# For `forest-express-sequelize` agents

To connect your new agent to a SQL database, you have two options:

- Use the `sequelize` ORM, like the old agent.
- Connect directly to the database using the `@forestadmin/datasource-sql` package.

The choice depends on your use case:

- Customers that have in-app installations and use the `sequelize` ORM in their code will probably want to keep using it.
- Others that only used `sequelize` because it was a requirement in the legacy agents will probably want to connect directly to their database and stop maintaining their `sequelize` models.

## If you choose to keep using `sequelize`

In that case, you will need to:

- Install the `@forestadmin/datasource-sequelize` package.
- Copy your `sequelize` models to the new project.
- Use the `@forestadmin/datasource-sequelize` connector.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSequelizeDataSource } = require('@forestadmin/datasource-sequelize');
const sequelize = require('./sequelize-models');

// Create agent and import collections from sequelize
const agent = createAgent(options).addDataSource(createSequelizeDataSource(sequelize));
```

## If you choose to connect directly to the database

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

# For `forest-express-mongoose` agents

## Connect to your MongoDB instance

To connect the new agent to a MongoDB instance, you still need to use the `mongoose` ODM.

You will need to:

- Install the `@forestadmin/datasource-mongoose` package.
- Copy your `mongoose` models to the new project.
- Create a new `mongoose` connection to the same database as the old one.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');
const connection = require('./mongoose-models');

// Create agent and import collections from mongoose.connection
const agent = createAgent(options).addDataSource(createMongooseDataSource(connection));
```

## Replicate your legacy agent flattener configuration

If you are using the `forest-express-mongoose` agent, you probably are using the [flattener](https://docs.forestadmin.com/documentation/how-tos/setup/flatten-nested-fields-mongodb) feature.

In the new agent, the flattener is [more capable](../../datasources/provided/mongoose.md), but the behavior of the new `auto` mode is different.

To replicate the behavior of the old agent, you will need to use the `manual` mode and configure the flattener manually.

{% hint style="info" %}
You may have noticed that a `flattenMode: 'legacy'` option is available.
This option **does not** replicate the behavior of legacy agents, but the behavior of a previous version of the model flattener in the new agents.

If you are migrating from a legacy agent, use the `manual` mode.
{% endhint %}

{% tabs %} {% tab title="Before" %}

```javascript
import { collection } from 'forest-express-mongoose';

collection('users', {
  /** ... other options ... */
  fieldsToFlatten: ['contactDetails'],
});

collection('products', {
  /** ... other options ... */
  fieldsToFlatten: [{ field: 'characteristics', level: 1 }],
});
```

{% endtab %} {% tab title="After" %}

If you were using `fieldsToFlatten` in your old agent.

```javascript
const agent = createAgent(options).addDataSource(
  createMongooseDataSource(connection, {
    flattenMode: 'manual',
    flattenOptions: {
      users: { asFields: ['contactDetails'] },
      products: { asFields: [{ field: 'characteristics', level: 1 }] },
    },
  }),
);
```

Otherwise

```javascript
const agent = createAgent(options).addDataSource(
  createMongooseDataSource(connection, { flattenMode: 'none' }),
);
```

{% endtab %} {% endtabs %}

# For other agents (Rails, Django, ...)

Other agents will be migrated using the [same process](#if-you-choose-to-connect-directly-to-the-database) as the `forest-express-sequelize` agent using the `@forestadmin/datasource-sql` package.
