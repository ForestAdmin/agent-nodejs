You can plug as many data sources as you want, no matter its type.
For example, you can plug a [Mongoose data source](../provided/mongoose.md) with a [SQL data source](../provided/sql.md). We take care of the compatibility for you.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');
const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');
// Mongoose connection with its model declarations.
const connection = require('./mongoose-models');

// Instantiate data sources.
const sqlDataSource = createSqlDataSource('postgres://user:pass@localhost:5432/mySchema');
const mongooseDataSource = createMongooseDataSource(connection);

// Plug every created data sources to the agent.
const agent = createAgent(options).addDataSource(sqlDataSource).addDataSource(mongooseDataSource);
```
