You may not want to import all collections from a data source.

This can be achieved by providing a whitelist or a blacklist in the options of the `agent.addDataSource` method.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const agent = createAgent(options);
const aDataSource = createSqlDataSource('postgres://user:pass@localhost:5432/mySchema');
const anoterDataSource = createSqlDataSource('postgres://user:pass@localhost:5432/mySchema');

// Specify which collection you want to play with
agent
  .addDataSource(aDataSource, { include: ['books', 'reviews'] })
  .addDataSource(anoterDataSource, { exclude: ['authors'] });
```
