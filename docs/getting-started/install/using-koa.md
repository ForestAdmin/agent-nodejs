If you already have an application running using [Koa](https://koajs.com/), the easiest way to attach the Forest Admin agent would use the `mountOnKoa` function, just like in the following example:

## Example with `koa`

```javascript
require('dotenv').config();

// Import the requirements
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const Koa = require('koa');

// Create your Forest Admin agent
(async () => {
  const app = new Koa();

  app.listen(3000);

  await createAgent({
    authSecret: process.env.FOREST_AUTH_SECRET,
    agentUrl: process.env.FOREST_AGENT_URL,
    envSecret: process.env.FOREST_ENV_SECRET,
    isProduction: process.env.NODE_ENV === 'production',
  })
    // Mount on Koa directly will be attached directly on top of your app.
    .mountOnKoa(app)
    .start();
})();
```
