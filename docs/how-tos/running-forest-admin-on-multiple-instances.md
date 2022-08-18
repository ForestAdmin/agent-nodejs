# Running Forest Admin on multiple instances

If you're running multiple instances of your agent (with a load balancer for example), you will need to set up a static client id.

{% hint style="warning" %}
**Without a static client id, authentication will fail whenever a user makes a request to a different instance than the one he logged into.**
{% endhint %}

First you will need to obtain a client id for your environment by running the following command:

```
curl -H "Content-Type: application/json" \
     -H "Authorization: Bearer <FOREST_ENV_SECRET>" \
     -X POST \
     -d '{"token_endpoint_auth_method": "none", "redirect_uris": ["<FOREST_AGENT_URL>/forest/authentication/callback"]}' \
     https://api.forestadmin.com/oidc/reg
```

Then assign the `client_id` value from the response (it's a JWT) to the `clientId` agent options. We strongly recommend to use an environment variable (`FOREST_CLIENT_ID`) to avoid misconfiguration between environments.

```javascript
require('dotenv').config();

const { createAgent } = require('@forestadmin/agent');

createAgent({
  ...
  isProduction: process.env.NODE_ENV === 'production',
  clientId: process.env.FOREST_CLIENT_ID,
})
```
