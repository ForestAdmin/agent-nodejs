The SQL connector allows to import tables from SQL databases.

It supports the following vendors:

- Postgres
- MySQL
- MariaDB
- SQLite
- Microsoft SQL Server
- Amazon Redshift
- Snowflake’s Data Cloud
- DB2
- IBM i

Each table will be mapped to a collection in Forest Admin.

```javascript
const SqlConnector = require('@forestadmin/connector-sql');

// Create agent and import collections from SQL database
const agent = new Agent(options);
agent.importCollectionsFrom(new SqlConnector('postgres://user:pass@localhost:5432/mySchema'));
```
