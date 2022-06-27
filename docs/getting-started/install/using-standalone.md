The following code example provide a way to run forestadmin as an independant process, running the `datasource-sql`.

You can obviously switch to any [other datasource](../../datasources/provided), and even [create your very own](../../datasources/custom/README.md).

As stated in the previous section, we strongly recommand to install the following packages via

`yarn add @forestadmin/agent@beta @forestadmin/datasource-sql@beta dotenv`

Depending on the database type you want to use, you may also need to install the associated javascript database driver (`pg` for postgres, `mysql2` for mariadb/mysql, `tedious` for mssql, etc).

For example, having an `index.js` containing:

{% tabs %} {% tab title="agent.js"}

```javascript
require('dotenv').config();

// Import the requirements
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

// Create your Forest Admin agent
createAgent({
  // These process.env variables should be provided in the onboarding
  authSecret: process.env.FOREST_AUTH_SECRET,
  agentUrl: process.env.FOREST_AGENT_URL,
  envSecret: process.env.FOREST_ENV_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
})
  // DATABASE_URL should be set to the connection string of your database
  .addDataSource(createSqlDataSource(process.env.DATABASE_URL))
  .mountOnStandaloneServer(3000)
  .start();
```

{% endtab %} {% tab title=".env" %}

```bash
FOREST_AUTH_SECRET=<This is provided during the onboarding steps>
FOREST_AGENT_URL=<This is provided during the onboarding steps>
FOREST_ENV_SECRET=<This is provided during the onboarding steps>
NODE_ENV=development
DATABASE_URL=your://development:database@connection.string
```

{% endtab %} {% endtabs %}
