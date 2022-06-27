```javascript
import 'dotenv/config';

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
