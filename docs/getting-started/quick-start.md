---
description: Let's get you up and running on Forest Admin in minutes!
---

### Step 1: Create an account

Go to [https://app.forestadmin.com/signup](https://app.forestadmin.com/signup), create an account and create a new project.

### Step 2: Instantiate your agent with a dummy datasource

{% code title="/forest/agent.js" %}

```javascript
const Agent = require('@forestadmin/agent');
const VideoClubDataSource = require('@forestadmin/datasource-videoclub');

// Create agent
const agent = new Agent({
  isProduction: false
  agentUrl: 'http://localhost:3351',
  authSecret: process.env.FOREST_AUTH_SECRET,
  envSecret: process.env.FOREST_ENV_SECRET,
});

// Connect it to dummy data so that we're up and running in no time.
agent.addDataSource(new VideoClubDataSource());

module.exports = agent;
```

{% endcode %}

# Exposing your agent to the outside world

{% tabs %} {% tab title="Standalone Agent" %}

```javascript
const http = require('http');
const agent = require('./forest/agent');

// Mount agent on a native NodeJS HTTP server
const port = 3351;
const server = http.createServer(agent.httpCallback);
server.listen(port);
```

{% endtab %}
{% tab title="Express.js in-app installation" %}

```javascript
const express = require('express');
const agent = require('./forest/agent');

// Create express app
const app = express();
const port = 3351;

// Agent is mounted on a dedicated prefix.
// It should go before mounting any middleware, as to avoid conflicts.
app.use('/forest', agent.httpCallback);

// Any route outsite of this prefix is free to use.
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port);
```

{% endtab %} {% tab title="Koa.js in-app installation" %}

```javascript
const Koa = require('koa');
const agent = require('./forest/agent');

const app = new Koa();
const port = 3351;

// Agent is mounted on a dedicated prefix.
// It should go before mounting any middleware, as to avoid conflicts.
app.use('/forest', agent.httpCallback);

// Any route outsite of this prefix is free to use.
app.use(async ctx => {
  ctx.body = 'Hello World';
});

app.listen(port);
```

{% endtab %} {% endtabs %}
