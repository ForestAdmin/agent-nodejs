As you can see in the previous paragraph, Forest Admin is able to run in a completely isolated context. However, in order to easily maintain your agent, you may want to attach the it directly.

### Example with `express`

```javascript
require('dotenv').config();

// Import the requirements
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const express = require('express');

// Create your Forest Admin agent
(async () => {
  const app = express();

  app.listen(3000);

  await createAgent({
    authSecret: process.env.FOREST_AUTH_SECRET,
    agentUrl: process.env.FOREST_AGENT_URL,
    envSecret: process.env.FOREST_ENV_SECRET,
    isProduction: process.env.NODE_ENV === 'production',
  })
    .addDataSource(createSqlDataSource(process.env.DATABASE_URL))
    .mountOnExpress(app)
    .start();
})();
```

### Example with `fastify`

```javascript
require('dotenv').config();

// Import the requirements
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const { fastify } = require('fastify');

// Create your Forest Admin agent
(async () => {
  const app = fastify();

  app.listen(3000);

  await createAgent({
    authSecret: process.env.FOREST_AUTH_SECRET,
    agentUrl: process.env.FOREST_AGENT_URL,
    envSecret: process.env.FOREST_ENV_SECRET,
    isProduction: process.env.NODE_ENV === 'production',
  })
    .addDataSource(createSqlDataSource(process.env.DATABASE_URL))
    .mountOnFastify(app)
    .start();
})();
```

### Example with `koa`

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
    .addDataSource(createSqlDataSource(process.env.DATABASE_URL))
    .mountOnKoa(app)
    .start();
})();
```

### Example with `NestJs`

```javascript
require('dotenv').config();

// Import the requirements
import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Module({ imports: [], controllers: [], providers: [] })
class AppModule {}

// Create your Forest Admin agent
(async () => {
  const app = await NestFactory.create(AppModule, { logger: false });

  const agent = createAgent({
    authSecret: process.env.FOREST_AUTH_SECRET,
    agentUrl: process.env.FOREST_AGENT_URL,
    envSecret: process.env.FOREST_ENV_SECRET,
    isProduction: process.env.NODE_ENV === 'production',
  })
    .addDataSource(createSqlDataSource(process.env.DATABASE_URL))
    .mountOnNestJs(app);

  await app.listen(3000);

  await agent.start();
})();
```
