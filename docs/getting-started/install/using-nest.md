If you already have an application running using [NestJS](https://nestjs.com/), the easiest way to attach the Forest Admin agent would use the `mountOnNestJs` function, just like in the following example:

```javascript
import 'dotenv/config';

import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Module({ imports: [], controllers: [], providers: [] })
class AppModule {}

(async () => {
  const app = await NestFactory.create(AppModule, { logger: false });

  const agent = createAgent({
    authSecret: process.env.FOREST_AUTH_SECRET,
    agentUrl: process.env.FOREST_AGENT_URL,
    envSecret: process.env.FOREST_ENV_SECRET,
    isProduction: process.env.NODE_ENV === 'production',
  })
    .mountOnNestJs(app);

  await app.listen(3000);

  await agent.start();
})();
```
