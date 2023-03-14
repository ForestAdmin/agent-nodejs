When importing collections to an admin panel, you may encounter naming collisions.

You can tackle them by renaming the collection that is causing issues.

There are two ways to rename collections: either provide a plain object which maps the old names to the new names, or a function which does the same.

Don't worry about leaving naming collisions: your development agent will warn you and crash at startup.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const agent = createAgent(options);
const sqlDataSource = createSqlDataSource('postgres://user:pass@localhost:5432/mySchema');

// Rename sqlDataSource collections by providing replacements
agent
  // Rename the `customers` and `stores` collections.
  // Note that other collections won't be renamed.
  .addDataSource(sqlDataSource, {
    rename: {
      customers: 'customersFromFrenchBranch',
      stores: 'storesFromFrenchBranch',
    },
  })

  // Renaming can also be done by providing a function.
  // All collections will be renamed (the handler is called once per collection)
  .addDataSource(sqlDataSource, { rename: name => `${name}FromSpanishBranch` });
```
