The SQL data source allows to import tables from SQL databases.

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

Each table in the database will be mapped to a collection in Forest Admin.

Note that, to be able to work, the credentials which are provided to the data source must be able to access the `information_schema`, as the agent will need it to extract the list of tables, columns and relations when the agent starts.

Taking database structure changes into account will require restarting the agent.

```javascript
const Agent = require('@forestadmin/agent');
const SqlDataSource = require('@forestadmin/datasource-sql');

// Create agent and import collections from SQL database
const agent = new Agent(options);
const sqlDataSource = new SqlDatasource('postgres://user:pass@localhost:5432/mySchema');
await sqlDataSource.build();
agent.addDataSource(sqlDataSource);
```
