Forest Admin is a low-code internal tool solution that scales with your project. With 30+ out-of-the-box tools and pre-built UI components, you can ship an admin panel in a few minutes, and then easily customise it to meet your specific business logic. Thanks to the layout editor, non-technical team members can adjust the UI to their needs.

Forest Admin has a unique hybrid architecture - only the frontend is managed on Forest Admin servers, which gives you the flexibility of a SaaS tool without compromising on data security.

## Requirements

- A local or remote working database

or

- An existing javascript app, configured to work with a database

Once you start creating a project, you will be able to choose a datasource. This page targets only the `SQL` datasource for now.

If you have the choice, we strongly recommend integrating in an existing app as it is easier to maintain.

The installation process will ask for your application endpoint. This endpoint must be correctly filled in order to onboard successfully. It is also required for the authentication process to work as expected. If you choose to make the agent independant of your main application, fill this endpoint with then endpoint you would like (http://localhost:3000 by default).

## Install Forest Admin with an SQL database

The following code example provide a way to run forestadmin as an independant process.

In order to make everything work as expected, we strongly recommand to install the following packages via

`yarn add @forestadmin/agent@beta @forestadmin/datasource-sql@beta dotenv`

Depending on the database type you want to use, you may also need to install the associated javascript driver (`pg` for postgres, `mysql2` for mariadb/mysql, `tedious` for mssql, etc).

For example, having an `index.js` containing:

```javascript
require('dotenv').config();

// Import the requirements
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

// Create your Forest Admin agent
(async () => {
  await createAgent({
    authSecret: process.env.FOREST_AUTH_SECRET,
    agentUrl: process.env.FOREST_AGENT_URL,
    envSecret: process.env.FOREST_ENV_SECRET,
    forestServerUrl: process.env.FOREST_SERVER_URL,
    isProduction: process.env.NODE_ENV === 'production',
  })
    .addDataSource(createSqlDataSource(process.env.DATABASE_URL))
    .mountOnStandaloneServer(3000)
    .start();
})();
```

and a `.env` containing:

```bash
FOREST_AUTH_SECRET=<This is provided during the onboarding steps>
FOREST_AGENT_URL=<This is provided during the onboarding steps>
FOREST_ENV_SECRET=<This is provided during the onboarding steps>
NODE_ENV=development
DATABASE_URL=your://development:database@connection.string
```

should be enough for you to fully onboard with the `SQL` datasource.

## Install Forest Admin within an existing javascript app

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
    forestServerUrl: process.env.FOREST_SERVER_URL,
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
    forestServerUrl: process.env.FOREST_SERVER_URL,
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
    forestServerUrl: process.env.FOREST_SERVER_URL,
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
    forestServerUrl: process.env.FOREST_SERVER_URL,
    isProduction: process.env.NODE_ENV === 'production',
  })
    .addDataSource(createSqlDataSource(process.env.DATABASE_URL))
    .mountOnNestJs(app);

  await app.listen(3000);

  await agent.start();
})();
```

## Help us get better!

Finally, when your local server is started, you should be automatically redirected to a satisfaction form. Rate us so we can improve, then go to your newly created admin panel

{% hint style="info" %}

If you installed Forest Admin on a local environment, your admin backend will most likely run on an HTTP endpoint.

This explains why, if you try to visit https://app.forestadmin.com, you will be redirected to http://app.forestadmin.com as this is the only way it can communicate with your local admin backend.

Deploying your project to production will enforce HTTPS.

{% endhint %}

# Troubleshooting

#### ❓ Don't you see an answer to your problem? Describe it on our [Developer Community Forum](https://community.forestadmin.com) and we will answer quickly.
