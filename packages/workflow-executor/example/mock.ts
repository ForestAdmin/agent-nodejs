/* eslint-disable no-console */
import MockAgentPort from './mock-agent-port';
import MockAiModelPort from './mock-ai-model-port';
import MockWorkflowPort from './mock-workflow-port';
import ExecutorHttpServer from '../src/http/executor-http-server';
import Runner from '../src/runner';
import SchemaCache from '../src/schema-cache';
import InMemoryStore from '../src/stores/in-memory-store';

const PORT = Number(process.env.PORT) || 3400;
const AUTH_SECRET = 'mock-auth-secret';

async function main() {
  const workflowPort = new MockWorkflowPort();
  const agentPort = new MockAgentPort();
  const aiModelPort = new MockAiModelPort(() => workflowPort.currentStepIndex);

  const runner = new Runner({
    workflowPort,
    agentPort,
    aiModelPort,
    runStore: new InMemoryStore(),
    schemaCache: new SchemaCache(),
    pollingIntervalMs: 3000,
    envSecret: 'a'.repeat(64),
    authSecret: AUTH_SECRET,
  });

  const server = new ExecutorHttpServer({
    port: PORT,
    runner,
    authSecret: AUTH_SECRET,
    workflowPort,
  });

  await runner.start();
  await server.start();

  console.log(`\n  Mock Workflow Executor running on http://localhost:${PORT}`);
  console.log(`  Auth secret: ${AUTH_SECRET}`);
  console.log(
    `  Generate JWT: node -e "console.log(require('jsonwebtoken').sign({id:1},'${AUTH_SECRET}'))"`,
  );
  console.log(`\n  Endpoints:`);
  console.log(`    GET  /health`);
  console.log(`    GET  /runs/run-1`);
  console.log(`    POST /runs/run-1/trigger\n`);

  const shutdown = async () => {
    console.log('\nShutting down...');
    await runner.stop();
    await server.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(console.error);
