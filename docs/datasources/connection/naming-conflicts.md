When importing collections to an admin panel, you may encounter naming collisions.

You can tackle them by renaming the collection that is causing issues.

Don't worry if you leave naming collisions, your development agent will warn you while starting.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const agent = createAgent(options);
const sqlDataSource = createSqlDataSource('postgres://user:pass@localhost:5432/mySchema');

// Rename sqlDataSource collections by providing replacements
agent.addDataSource(sqlDataSource, {
  // In this example, it will rename the `customers` and `stores` collections
  // to `superCustomers` and `superStores`.
  rename: {
    customers: 'superCustomers',
    stores: 'superStores',
  },
});
```
