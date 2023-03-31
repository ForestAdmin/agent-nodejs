If you already have an application running using [Fastify](https://www.fastify.io/), the easiest way to attach the Forest Admin agent would use the `mountOnFastify` function, just like in the following example:

```javascript
require('dotenv').config();

const { fastify } = require('fastify');
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const agent = createAgent({
  authSecret: process.env.FOREST_AUTH_SECRET,
  envSecret: process.env.FOREST_ENV_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
});

const app = fastify();

// This function must be called before other middlewares.
agent.mountOnFastify(app).start();

app.listen(3000);
```

## Using Fastify v4.x

You should use [@fastify/middie](https://github.com/fastify/middie) library to be able to use Fastify v4.x with Forest Admin.

This library adds middleware support to Fastify.

```javascript
const fastifyAppV4 = Fastify();
await fastifyAppV4.register(import('@fastify/middie'));
agent.mountOnFastify(fastifyAppV4);
```
