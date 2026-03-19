// TODO: implement polling loop, execution dispatch, AI wiring (see spec section 4.1)

import type { AgentPort } from './ports/agent-port';
import type { RunStore } from './ports/run-store';
import type { WorkflowPort } from './ports/workflow-port';

import ExecutorHttpServer from './http/executor-http-server';

export interface RunnerConfig {
  agentPort: AgentPort;
  workflowPort: WorkflowPort;
  runStore: RunStore;
  pollingIntervalMs: number;
  httpPort?: number;
}

export default class Runner {
  private readonly config: RunnerConfig;
  private httpServer: ExecutorHttpServer | null = null;

  constructor(config: RunnerConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.config.httpPort !== undefined && !this.httpServer) {
      const server = new ExecutorHttpServer({
        port: this.config.httpPort,
        runStore: this.config.runStore,
        runner: this,
      });
      await server.start();
      this.httpServer = server;
    }

    // TODO: start polling loop
  }

  async stop(): Promise<void> {
    if (this.httpServer) {
      await this.httpServer.stop();
      this.httpServer = null;
    }

    // TODO: stop polling loop, close connections
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
  async triggerPoll(_runId: string): Promise<void> {
    // TODO: trigger immediate poll cycle for this runId
  }
}
