When using a standalone agent, you can choose both the port and network adapter that your app should be exposed to.

Both parameters of the `mountOnStandaloneServer(port, host)` are optional:
- the `port` defaults `3351`
- the `host` defaults to the unspecified IPv6 address (`::`) when IPv6 is available, or the unspecified IPv4 address (`0.0.0.0`) otherwise.

```javascript
require('dotenv').config();

const { createAgent } = require('@forestadmin/agent');

const agent = createAgent({
  authSecret: process.env.FOREST_AUTH_SECRET,
  envSecret: process.env.FOREST_ENV_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
});

agent.mountOnStandaloneServer(3000, '127.0.0.1').start();
```
