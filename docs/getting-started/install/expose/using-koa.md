If you already have an application running using [Koa](https://koajs.com/), the easiest way to attach the Forest Admin agent would use the `mountOnKoa` function, just like in the following example:

```javascript
require('dotenv').config();

const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');
const Koa = require('koa');

const agent = createAgent({
  authSecret: process.env.FOREST_AUTH_SECRET,
  envSecret: process.env.FOREST_ENV_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
});

const app = new Koa();

// This function must be called before other middlewares.
agent.mountOnKoa(app).start();

app.listen(3000);
```
