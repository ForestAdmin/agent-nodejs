import type { RunStore } from './ports/run-store';
import type { StepExecutionData } from './types/step-execution-data';

import { AiClient } from '@forestadmin/ai-proxy';

import AgentClientAgentPort from './adapters/agent-client-agent-port';
import ForestServerWorkflowPort from './adapters/forest-server-workflow-port';
import Runner from './runner';

/** Simple in-memory RunStore — suitable for single-instance deployments. */
class InMemoryRunStore implements RunStore {
  private readonly store = new Map<string, StepExecutionData[]>();

  async getStepExecutions(runId: string): Promise<StepExecutionData[]> {
    return this.store.get(runId) ?? [];
  }

  async saveStepExecution(runId: string, stepExecution: StepExecutionData): Promise<void> {
    const executions = this.store.get(runId) ?? [];
    executions.push(stepExecution);
    this.store.set(runId, executions);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const envSecret = requireEnv('FOREST_ENV_SECRET');
  const authSecret = requireEnv('FOREST_AUTH_SECRET');
  const forestServerUrl = requireEnv('FOREST_SERVER_URL');
  const agentUrl = requireEnv('FOREST_AGENT_URL');
  const httpPort = Number(process.env.EXECUTOR_HTTP_PORT ?? '4001');
  const pollingIntervalMs = Number(process.env.EXECUTOR_POLLING_INTERVAL_MS ?? '5000');

  const aiConfigurations = [];

  if (process.env.AI_PROVIDER && process.env.AI_API_KEY && process.env.AI_MODEL) {
    aiConfigurations.push({
      name: process.env.AI_CONFIG_NAME ?? 'default',
      provider: process.env.AI_PROVIDER,
      apiKey: process.env.AI_API_KEY,
      model: process.env.AI_MODEL,
    });
  }

  const { createRemoteAgentClient } = await import('@forestadmin/agent-client');

  const agentClient = createRemoteAgentClient({ url: agentUrl });
  const workflowPort = new ForestServerWorkflowPort({ envSecret, forestServerUrl });
  const agentPort = new AgentClientAgentPort({ client: agentClient, collectionSchemas: {} });
  const runStore = new InMemoryRunStore();
  const aiClient = new AiClient({ aiConfigurations });

  const runner = new Runner({
    agentPort,
    workflowPort,
    runStore,
    pollingIntervalMs,
    aiClient,
    envSecret,
    authSecret,
    httpPort,
  });

  await runner.start();
  console.log(`Workflow executor started on port ${httpPort}`);

  const shutdown = async () => {
    console.log('Shutting down...');
    await runner.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(err => {
  console.error('Failed to start workflow executor:', err);
  process.exit(1);
});
