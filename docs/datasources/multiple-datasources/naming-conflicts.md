When importing collections to an admin panel, you may encounter naming collisions.

You can tackle them by renaming the collection which are causing issues.

Don't worry if you leave naming collisions, your development agent will warn you while starting.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const agent = createAgent(options);
const sqlDataSource = new createSqlDataSource('postgres://user:pass@localhost:5432/mySchema');

// Rename sqlDataSource collections by providing replacements
agent.addDataSource(sqlDataSource, {
  // The rename option is a hashmap, with the key being the current name of the collection, and the value the new name for this collection.
  // In this example, it will rename the `customer` collection to `superCustomers`
  rename: {
    customers: 'superCustomers',
  },
});
```
