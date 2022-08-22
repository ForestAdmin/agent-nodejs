If you already have an application running using [Fastify](https://www.fastify.io/), the easiest way to attach the Forest Admin agent would use the `mountOnFastify` function, just like in the following example:

```javascript
require('dotenv').config();

const { fastify } = require('fastify');
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const agent = createAgent({
  authSecret: process.env.FOREST_AUTH_SECRET,
  agentUrl: process.env.FOREST_AGENT_URL,
  envSecret: process.env.FOREST_ENV_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
});

const app = fastify();

// This function must be called before other middlewares.
agent.mountOnFastify(app).start();

app.listen(3000);
```
