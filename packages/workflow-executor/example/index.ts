import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '.env') });

import { buildDatabaseExecutor } from '../src/index';

const executor = buildDatabaseExecutor({
  envSecret: process.env.FOREST_ENV_SECRET!,
  authSecret: process.env.FOREST_AUTH_SECRET!,
  agentUrl: process.env.AGENT_URL!,
  httpPort: Number(process.env.HTTP_PORT ?? 3400),
  forestServerUrl: process.env.FOREST_SERVER_URL,
  pollingIntervalMs: Number(process.env.POLLING_INTERVAL_MS ?? 5000),
  database: {
    uri: process.env.DATABASE_URL!,
  },
  aiConfigurations: [
    {
      name: 'default',
      provider: process.env.AI_PROVIDER as 'anthropic' | 'openai',
      model: process.env.AI_MODEL!,
      apiKey: process.env.AI_API_KEY!,
    },
  ],
});

executor.start().then(() => {
  console.log(`Workflow executor started on port ${process.env.HTTP_PORT ?? 3400}`);
});
