If you already have an application running using [Fastify](https://www.fastify.io/), the easiest way to attach the Forest Admin agent would use the `mountOnFastify` function, just like in the following example:

```javascript
require('dotenv').config();

const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const { fastify } = require('fastify');

(async () => {
  const app = fastify();

  app.listen(3000);

  await createAgent({
    authSecret: process.env.FOREST_AUTH_SECRET,
    agentUrl: process.env.FOREST_AGENT_URL,
    envSecret: process.env.FOREST_ENV_SECRET,
    isProduction: process.env.NODE_ENV === 'production',
  })
    .mountOnFastify(app)
    .start();
})();
```
