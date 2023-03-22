The SQL data source allows importing tables from SQL databases.

Each table in the database will be mapped to a collection in Forest Admin.

Note that, to be able to work, the credentials which are provided to the data source must be able to access the `information_schema`, as the agent will need it to extract the list of tables, columns, and relations when the agent starts.

Taking database structure changes into account will require restarting the agent.

## Installation

To make everything work as expected, you need to:

- install the package `@forestadmin/datasource-sql`.
- install the native drivers for the vendors you are aiming to connect to. For example, if you want to connect to a MySQL database, you need to install `mysql2`.

| Vendor               | Install extra package |
| -------------------- | --------------------- |
| MariaDB              | `mariadb`             |
| Microsoft SQL Server | `tedious`             |
| MySQL                | `mysql2`              |
| Oracle               | `oracledb`            |
| PostgreSQL           | `pg` + `pg-hstore`    |
| SQLite               | `sqlite3`             |

## Configuration

Configuration can be as simple as passing a URI to the data source constructor, but more options are available:

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

// Create agent and import collections from SQL database
const agent = createAgent(options).addDataSource(createSqlDataSource({
  ////////////////////////
  // Connection options //
  ////////////////////////

  /** URI where the database can be reached */
  uri: 'postgres://user:pass@localhost:5432/myDatabase',

  // OR

  /** The dialect of the database you are connecting to */
  dialect: 'postgres',

  /** The name of the database */
  database: 'myDatabase',

  /** The username which is used to authenticate against the database */
  username: 'user',

  /** The password which is used to authenticate against the database */
  password: 'pass',

  /** The host of the relational database */
  host: 'localhost',

  /** The port of the relational database */
  port: 5432

  ///////////////////
  // Extra options //
  ///////////////////

  /** If defined the connection will use the provided schema instead of the default ("public") */
  schema: 'public'

  /** A flag that defines if a TLS connection should be used */
  ssl: false,

  /** Only for PostgreSQL: A flag that defines if `pg-native` shall be used or not */
  native: false,

  /** Only for SQLite: path where the database file is located */
  // storage: '/tmp/my-sqlite-database.db'

  /** Connection pool options */
  pool: {
    /** Maximum number of connection in pool */
    max: 5,

    /** Minimum number of connection in pool */
    min: 0,

    /** Maximum time, in milliseconds, that pool will try to get connection before throwing error */
    acquire: 30000,

    /** Maximum time, in milliseconds, that a connection can be idle before being released */
    idle: 10000,
  },

  /**
   * Use read / write replication.
   * @see https://sequelize.org/docs/v6/other-topics/read-replication/
   */
  replication: false,
}));
```

Note that under the hood, the data source uses [Sequelize](https://sequelize.org/) to connect to the database. So, you can pass any option that is supported by Sequelize.
