You can plug as many data sources as you want, no matter its type.
For example, you can plug a [Mongoose data source](../provided/mongoose.md) with a [Sql data source](../provided/sql.md). We take care of the compatibility for you.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');
const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');
// It gets the mongoose connection with its model declarations.
// please go to `Data sources -> Provided datasources -> mongoose` to know more about this line.
const connection = require('./mongoose-models'); 

// instanciate data sources
const sqlDataSource = createSqlDataSource('postgres://user:pass@localhost:5432/mySchema');
const mongooseDataSource = createMongooseDataSource(connection);

// plug every created data sources to the agent.
const agent = createAgent(options).addDataSource(sqlDataSource).addDataSource(mongooseDataSource);
```

{% hint style="info" %}
If you want to add some relations between them, please refer to this [section](../custom/query-translation/relationships.md).
{% endhint %}

## Naming conflicts

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
  rename: {
    customers: 'superCustomers',
  },
});
```
