// TODO: implement polling loop, execution dispatch, AI wiring (see spec section 4.1)

import type { RunStoreFactory } from './http/run-store-factory';
import type { AgentPort } from './ports/agent-port';
import type { WorkflowPort } from './ports/workflow-port';

import ExecutorHttpServer from './http/executor-http-server';

export interface WorkflowRunnerConfig {
  ports: {
    agent: AgentPort;
    workflow: WorkflowPort;
  };
  runStoreFactory: RunStoreFactory;
  pollingIntervalMs: number;
  httpPort?: number;
}

export default class WorkflowRunner {
  private readonly config: WorkflowRunnerConfig;
  private httpServer: ExecutorHttpServer | null = null;

  constructor(config: WorkflowRunnerConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.config.httpPort) {
      this.httpServer = new ExecutorHttpServer({
        port: this.config.httpPort,
        runStoreFactory: this.config.runStoreFactory,
        workflowRunner: this,
      });
      await this.httpServer.start();
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
