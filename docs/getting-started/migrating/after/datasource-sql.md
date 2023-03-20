To connect your new agent to a SQL database, you have two options:

|          | Keep Sequelize                                                                     | Connect directly to the database                                                    |
| -------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| How      | Use the `@forestadmin/datasource-sequelize` package                                | Use the `@forestadmin/datasource-sql` package                                       |
| For whom | Customers that have in-app installations and use the `Sequelize` ORM in their code | Others that only used `Sequelize` because it was a requirement in the legacy agents |
| Benefits | Migration is less error-prone                                                      | You no longer need to maintain `Sequelize` models                                   |
| Cons     |                                                                                    | You may need to rename your tables and fields to match the old install              |

If you wish to migrate to the new `@forestadmin/datasource-sql` connectors, you will need to:

Changing the dependency in your agent:

```console
$ npm remove @forestadmin/datasource-sequelize
$ npm install @forestadmin/datasource-sql
```

Then you can delete your `Sequelize` models and change the `index` file.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

// Create agent and import collections from SQL database
const agent = createAgent(options).addDataSource(
  createSqlDataSource('postgres://user:pass@localhost:5432/myDatabase'),
);
```

Then, depending on your database structure, you may need to rename both your tables and columns: the new agent will use the same names as your database, but depending on your previous Sequelize configuration, `Sequelize` may have renamed all tables and fields to `camelCase`.

Renaming tables and fields can be done by following this example:

```javascript
// Convert snake_case to camelCase
const toCamelCase = name => name.replace(/(_\w)/g, k => k[1].toUpperCase());

const agent = createAgent(options)
  // If your collection names do not match between the old and new agent
  // you can rename them using the `rename` option of the `addDataSource` function.

  // Note that in your code, you will use the camelCase names.
  .addDataSource(createSqlDataSource('postgres://user:pass@localhost:5432/myDatabase'), {
    rename: toCamelCase,
  })

  // If your field names do not match between the old and new agent
  // you can rename them using the `renameField` function on all fields.

  // Note unlike with collection names, which are renamed in the internal representation,
  // you will still need to use the unrenamed field names in your code.
  .use(async ds => {
    for (const collection of ds.collections)
      for (const field of Object.keys(collection.schema.fields))
        collection.renameField(field, toCamelCase(field));
  });
```
