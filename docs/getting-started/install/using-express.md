If you already have an application running using [Express](https://expressjs.com/), the easiest way to attach the Forest Admin agent would use the `mountOnExpress` function, just like in the following example:

```javascript
require('dotenv').config();

const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const express = require('express');

(async () => {
  const app = express();

  app.listen(3000);

  await createAgent({
    authSecret: process.env.FOREST_AUTH_SECRET,
    agentUrl: process.env.FOREST_AGENT_URL,
    envSecret: process.env.FOREST_ENV_SECRET,
    isProduction: process.env.NODE_ENV === 'production',
  })
    .mountOnExpress(app)
    .start();
})();
```
