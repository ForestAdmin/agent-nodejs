When using a standalone agent, you only need to choose the port that your app should be exposed to.

```javascript
require('dotenv').config();

const { createAgent } = require('@forestadmin/agent');

const agent = createAgent({
  authSecret: process.env.FOREST_AUTH_SECRET,
  envSecret: process.env.FOREST_ENV_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
});

agent.mountOnStandaloneServer(3000).start();
```
