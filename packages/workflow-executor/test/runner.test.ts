import type { StepContextConfig } from '../src/executors/step-executor-factory';
import type { AgentPort } from '../src/ports/agent-port';
import type { Logger } from '../src/ports/logger-port';
import type { RunStore } from '../src/ports/run-store';
import type { WorkflowPort } from '../src/ports/workflow-port';
import type { PendingStepExecution } from '../src/types/execution';
import type { StepDefinition } from '../src/types/step-definition';
import type { AiClient, BaseChatModel } from '@forestadmin/ai-proxy';

import {
  ConfigurationError,
  InvalidPendingDataError,
  PendingDataNotFoundError,
  RunNotFoundError,
  UserMismatchError,
} from '../src/errors';
import BaseStepExecutor from '../src/executors/base-step-executor';
import ConditionStepExecutor from '../src/executors/condition-step-executor';
import LoadRelatedRecordStepExecutor from '../src/executors/load-related-record-step-executor';
import McpTaskStepExecutor from '../src/executors/mcp-task-step-executor';
import ReadRecordStepExecutor from '../src/executors/read-record-step-executor';
import StepExecutorFactory from '../src/executors/step-executor-factory';
import TriggerRecordActionStepExecutor from '../src/executors/trigger-record-action-step-executor';
import UpdateRecordStepExecutor from '../src/executors/update-record-step-executor';
import ExecutorHttpServer from '../src/http/executor-http-server';
import Runner from '../src/runner';
import SchemaCache from '../src/schema-cache';
import { StepType } from '../src/types/step-definition';

jest.mock('../src/http/executor-http-server');

const MockedExecutorHttpServer = ExecutorHttpServer as jest.MockedClass<typeof ExecutorHttpServer>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const POLLING_INTERVAL_MS = 1000;

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

function createMockWorkflowPort(): jest.Mocked<WorkflowPort> {
  return {
    getPendingStepExecutions: jest.fn().mockResolvedValue([]),
    getPendingStepExecutionsForRun: jest.fn(),
    updateStepExecution: jest.fn().mockResolvedValue(undefined),
    getCollectionSchema: jest.fn(),
    getMcpServerConfigs: jest.fn().mockResolvedValue([]),
    hasRunAccess: jest.fn().mockResolvedValue(true),
  };
}

function createMockAiClient() {
  return {
    getModel: jest.fn().mockReturnValue({} as BaseChatModel),
    loadRemoteTools: jest.fn().mockResolvedValue([]),
    closeConnections: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockLogger(): jest.Mocked<Logger> {
  return { error: jest.fn() };
}

const VALID_ENV_SECRET = 'a'.repeat(64);
const VALID_AUTH_SECRET = 'test-auth-secret';

function createMockRunStore(overrides: Partial<RunStore> = {}): jest.Mocked<RunStore> {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue([]),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<RunStore>;
}

function createRunnerConfig(
  overrides: Partial<{
    workflowPort: WorkflowPort;
    runStore: RunStore;
    aiClient: AiClient;
    logger: Logger;
    httpPort: number;
    envSecret: string;
    authSecret: string;
    schemaCache: SchemaCache;
  }> = {},
) {
  return {
    agentPort: {} as AgentPort,
    workflowPort: createMockWorkflowPort(),
    runStore: {
      init: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      getStepExecutions: jest.fn().mockResolvedValue([]),
      saveStepExecution: jest.fn().mockResolvedValue(undefined),
    } as unknown as RunStore,
    pollingIntervalMs: POLLING_INTERVAL_MS,
    aiClient: createMockAiClient() as unknown as AiClient,
    logger: createMockLogger(),
    schemaCache: new SchemaCache(),
    envSecret: VALID_ENV_SECRET,
    authSecret: VALID_AUTH_SECRET,
    ...overrides,
  };
}

function makeStepDefinition(stepType: StepType): StepDefinition {
  if (stepType === StepType.Condition) {
    return { type: StepType.Condition, options: ['opt1', 'opt2'] };
  }

  if (stepType === StepType.McpTask) {
    return { type: StepType.McpTask };
  }

  return { type: stepType as Exclude<StepType, StepType.Condition | StepType.McpTask> };
}

function makePendingStep(
  overrides: Partial<PendingStepExecution> & { stepType?: StepType } = {},
): PendingStepExecution {
  const { stepType = StepType.ReadRecord, ...rest } = overrides;

  return {
    runId: 'run-1',
    stepId: 'step-1',
    stepIndex: 0,
    baseRecordRef: { collectionName: 'customers', recordId: ['1'], stepIndex: 0 },
    stepDefinition: makeStepDefinition(stepType),
    previousSteps: [],
    user: {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      team: 'admin',
      renderingId: 1,
      role: 'admin',
      permissionLevel: 'admin',
      tags: {},
    },
    ...rest,
  };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let executeSpy: jest.SpyInstance;
let runner: Runner;

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();

  MockedExecutorHttpServer.prototype.start = jest.fn().mockResolvedValue(undefined);
  MockedExecutorHttpServer.prototype.stop = jest.fn().mockResolvedValue(undefined);

  executeSpy = jest.spyOn(BaseStepExecutor.prototype, 'execute').mockResolvedValue({
    stepOutcome: { type: 'record-task', stepId: 'step-1', stepIndex: 0, status: 'success' },
  });
});

afterEach(async () => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (runner) {
    await runner.stop();
    (runner as Runner | undefined) = undefined;
  }

  jest.clearAllTimers();
});

// ---------------------------------------------------------------------------
// HTTP server (existing tests, kept passing)
// ---------------------------------------------------------------------------

describe('start', () => {
  it('should start the HTTP server when httpPort is configured', async () => {
    const config = createRunnerConfig({ httpPort: 3100 });
    runner = new Runner(config);

    await runner.start();

    expect(MockedExecutorHttpServer).toHaveBeenCalledWith({
      port: 3100,
      runner,
      authSecret: VALID_AUTH_SECRET,
      workflowPort: config.workflowPort,
      logger: config.logger,
    });
    expect(MockedExecutorHttpServer.prototype.start).toHaveBeenCalled();
  });

  it('should not start the HTTP server when httpPort is not configured', async () => {
    runner = new Runner(createRunnerConfig());

    await runner.start();

    expect(MockedExecutorHttpServer).not.toHaveBeenCalled();
  });

  it('should not create a second HTTP server if already started', async () => {
    runner = new Runner(createRunnerConfig({ httpPort: 3100 }));

    await runner.start();
    await runner.start();

    expect(MockedExecutorHttpServer).toHaveBeenCalledTimes(1);
  });

  it('should call runStore.init() on start', async () => {
    const config = createRunnerConfig();
    runner = new Runner(config);

    await runner.start();

    expect(config.runStore.init).toHaveBeenCalledTimes(1);
  });

  it('should throw ConfigurationError when envSecret is invalid', async () => {
    runner = new Runner(createRunnerConfig({ envSecret: 'bad' }));

    await expect(runner.start()).rejects.toThrow(ConfigurationError);
    await expect(runner.start()).rejects.toThrow('envSecret must be a 64-character hex string');
  });

  it('should throw ConfigurationError when authSecret is empty', async () => {
    runner = new Runner(createRunnerConfig({ authSecret: '' }));

    await expect(runner.start()).rejects.toThrow(ConfigurationError);
    await expect(runner.start()).rejects.toThrow('authSecret must be a non-empty string');
  });
});

describe('stop', () => {
  it('should stop the HTTP server when running', async () => {
    runner = new Runner(createRunnerConfig({ httpPort: 3100 }));

    await runner.start();
    await runner.stop();

    expect(MockedExecutorHttpServer.prototype.stop).toHaveBeenCalled();
  });

  it('should call runStore.close() on stop', async () => {
    const config = createRunnerConfig();
    runner = new Runner(config);

    await runner.start();
    await runner.stop();

    expect(config.runStore.close).toHaveBeenCalledTimes(1);
  });

  it('should handle stop when no HTTP server is running', async () => {
    runner = new Runner(createRunnerConfig());

    await expect(runner.stop()).resolves.toBeUndefined();
  });

  it('should allow restarting after stop', async () => {
    runner = new Runner(createRunnerConfig({ httpPort: 3100 }));

    await runner.start();
    await runner.stop();
    await runner.start();

    expect(MockedExecutorHttpServer).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Polling loop
// ---------------------------------------------------------------------------

describe('polling loop', () => {
  it('schedules a poll after pollingIntervalMs', async () => {
    const workflowPort = createMockWorkflowPort();
    runner = new Runner(createRunnerConfig({ workflowPort }));
    await runner.start();

    expect(workflowPort.getPendingStepExecutions).not.toHaveBeenCalled();

    jest.advanceTimersByTime(POLLING_INTERVAL_MS);
    await flushPromises();

    expect(workflowPort.getPendingStepExecutions).toHaveBeenCalledTimes(1);
  });

  it('reschedules automatically after each cycle', async () => {
    const workflowPort = createMockWorkflowPort();
    runner = new Runner(createRunnerConfig({ workflowPort }));
    await runner.start();

    jest.advanceTimersByTime(POLLING_INTERVAL_MS);
    await flushPromises();
    expect(workflowPort.getPendingStepExecutions).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(POLLING_INTERVAL_MS);
    await flushPromises();
    expect(workflowPort.getPendingStepExecutions).toHaveBeenCalledTimes(2);
  });

  it('stop() prevents scheduling a new cycle', async () => {
    const workflowPort = createMockWorkflowPort();
    runner = new Runner(createRunnerConfig({ workflowPort }));
    await runner.start();

    jest.advanceTimersByTime(POLLING_INTERVAL_MS);
    await flushPromises();
    expect(workflowPort.getPendingStepExecutions).toHaveBeenCalledTimes(1);

    await runner.stop();

    jest.advanceTimersByTime(POLLING_INTERVAL_MS * 3);
    await flushPromises();

    expect(workflowPort.getPendingStepExecutions).toHaveBeenCalledTimes(1);
  });

  it('stop() clears the pending timer', async () => {
    const workflowPort = createMockWorkflowPort();
    runner = new Runner(createRunnerConfig({ workflowPort }));
    await runner.start();

    await runner.stop();

    jest.advanceTimersByTime(POLLING_INTERVAL_MS);
    await flushPromises();

    expect(workflowPort.getPendingStepExecutions).not.toHaveBeenCalled();
  });

  it('calling start() twice does not schedule two timers', async () => {
    const workflowPort = createMockWorkflowPort();
    runner = new Runner(createRunnerConfig({ workflowPort }));

    await runner.start();
    await runner.start();

    jest.advanceTimersByTime(POLLING_INTERVAL_MS);
    await flushPromises();

    expect(workflowPort.getPendingStepExecutions).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe('deduplication', () => {
  it('skips a step whose key is already in inFlightSteps', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1', stepId: 'inflight-step' });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);

    // Block the first execution so the key stays in-flight
    const unblockRef = { fn: (): void => {} };
    executeSpy.mockReturnValueOnce(
      new Promise(resolve => {
        unblockRef.fn = () =>
          resolve({
            stepOutcome: {
              type: 'record-task',
              stepId: 'inflight-step',
              stepIndex: 0,
              status: 'success',
            },
          });
      }),
    );

    runner = new Runner(createRunnerConfig({ workflowPort }));

    const poll1 = runner.triggerPoll('run-1');
    await Promise.resolve(); // let getPendingStepExecutionsForRun resolve and step key get added

    // Second poll: step is in-flight → should be skipped
    await runner.triggerPoll('run-1');

    expect(executeSpy).toHaveBeenCalledTimes(1);

    unblockRef.fn();
    await poll1;
  });

  it('removes the step key after successful execution', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1', stepId: 'step-dedup' });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);

    runner = new Runner(createRunnerConfig({ workflowPort }));

    await runner.triggerPoll('run-1');
    await runner.triggerPoll('run-1');

    expect(executeSpy).toHaveBeenCalledTimes(2);
  });

  it('removes the step key even when executor construction fails', async () => {
    const workflowPort = createMockWorkflowPort();
    const aiClient = createMockAiClient();
    const step = makePendingStep({ runId: 'run-1', stepId: 'step-throws' });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    aiClient.getModel.mockImplementationOnce(() => {
      throw new Error('construction error');
    });

    runner = new Runner(
      createRunnerConfig({ workflowPort, aiClient: aiClient as unknown as AiClient }),
    );

    await runner.triggerPoll('run-1');
    await runner.triggerPoll('run-1');

    // Both polls completed: the step key was cleared after the first (failed) execution
    expect(workflowPort.updateStepExecution).toHaveBeenCalledTimes(2);
    // First poll produced an error outcome from the construction failure
    expect(workflowPort.updateStepExecution).toHaveBeenNthCalledWith(
      1,
      'run-1',
      expect.objectContaining({ status: 'error', error: 'An unexpected error occurred.' }),
    );
  });
});

// ---------------------------------------------------------------------------
// triggerPoll
// ---------------------------------------------------------------------------

describe('triggerPoll', () => {
  it('calls getPendingStepExecutionsForRun with the given runId and executes the step', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-A', stepId: 'step-a' });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);

    runner = new Runner(createRunnerConfig({ workflowPort }));
    await runner.triggerPoll('run-A');

    expect(workflowPort.getPendingStepExecutionsForRun).toHaveBeenCalledWith('run-A');
    expect(workflowPort.getPendingStepExecutions).not.toHaveBeenCalled();
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith('run-A', expect.anything());
  });

  it('skips in-flight steps', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1', stepId: 'step-inflight' });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);

    const unblockRef = { fn: (): void => {} };
    executeSpy.mockReturnValueOnce(
      new Promise(resolve => {
        unblockRef.fn = () =>
          resolve({
            stepOutcome: {
              type: 'record-task',
              stepId: 'step-inflight',
              stepIndex: 0,
              status: 'success',
            },
          });
      }),
    );

    runner = new Runner(createRunnerConfig({ workflowPort }));

    const poll1 = runner.triggerPoll('run-1');
    await Promise.resolve();

    await runner.triggerPoll('run-1');

    expect(executeSpy).toHaveBeenCalledTimes(1);

    unblockRef.fn();
    await poll1;
  });

  it('resolves after the step has settled', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1', stepId: 'step-a' });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);

    runner = new Runner(createRunnerConfig({ workflowPort }));

    await expect(runner.triggerPoll('run-1')).resolves.toBeUndefined();
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects with RunNotFoundError when getPendingStepExecutionsForRun returns null', async () => {
    const workflowPort = createMockWorkflowPort();
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(null);

    runner = new Runner(createRunnerConfig({ workflowPort }));

    await expect(runner.triggerPoll('run-1')).rejects.toThrow(RunNotFoundError);
  });

  it('propagates errors from getPendingStepExecutionsForRun as-is', async () => {
    const workflowPort = createMockWorkflowPort();
    workflowPort.getPendingStepExecutionsForRun.mockRejectedValue(new Error('Network error'));

    runner = new Runner(createRunnerConfig({ workflowPort }));

    await expect(runner.triggerPoll('run-1')).rejects.toThrow('Network error');
  });
});

// ---------------------------------------------------------------------------
// MCP lazy loading
// ---------------------------------------------------------------------------

describe('MCP lazy loading (via once thunk)', () => {
  it('does not call fetchRemoteTools when there are no McpTask steps', async () => {
    const workflowPort = createMockWorkflowPort();
    const aiClient = createMockAiClient();
    const step = makePendingStep({ runId: 'run-1', stepType: StepType.ReadRecord });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);

    runner = new Runner(
      createRunnerConfig({ workflowPort, aiClient: aiClient as unknown as AiClient }),
    );
    await runner.triggerPoll('run-1');

    expect(workflowPort.getMcpServerConfigs).not.toHaveBeenCalled();
    expect(aiClient.loadRemoteTools).not.toHaveBeenCalled();
  });

  it('calls fetchRemoteTools once for an McpTask step', async () => {
    const workflowPort = createMockWorkflowPort();
    const aiClient = createMockAiClient();
    const step = makePendingStep({
      runId: 'run-1',
      stepId: 'step-mcp-1',
      stepType: StepType.McpTask,
    });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    // Provide a non-empty config so fetchRemoteTools actually calls loadRemoteTools
    workflowPort.getMcpServerConfigs.mockResolvedValue([{ configs: {} }] as never);

    runner = new Runner(
      createRunnerConfig({ workflowPort, aiClient: aiClient as unknown as AiClient }),
    );
    await runner.triggerPoll('run-1');

    expect(workflowPort.getMcpServerConfigs).toHaveBeenCalledTimes(1);
    expect(aiClient.loadRemoteTools).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getExecutor — factory
// ---------------------------------------------------------------------------

describe('StepExecutorFactory.create — factory', () => {
  const makeContextConfig = (): StepContextConfig => ({
    aiClient: {
      getModel: jest.fn().mockReturnValue({} as BaseChatModel),
    } as unknown as AiClient,
    agentPort: {} as AgentPort,
    workflowPort: {} as WorkflowPort,
    runStore: {} as RunStore,
    schemaCache: new SchemaCache(),
    logger: { error: jest.fn() },
  });

  it('dispatches Condition steps to ConditionStepExecutor', async () => {
    const step = makePendingStep({ stepType: StepType.Condition });
    const executor = await StepExecutorFactory.create(step, makeContextConfig(), jest.fn());
    expect(executor).toBeInstanceOf(ConditionStepExecutor);
  });

  it('dispatches ReadRecord steps to ReadRecordStepExecutor', async () => {
    const step = makePendingStep({ stepType: StepType.ReadRecord });
    const executor = await StepExecutorFactory.create(step, makeContextConfig(), jest.fn());
    expect(executor).toBeInstanceOf(ReadRecordStepExecutor);
  });

  it('dispatches UpdateRecord steps to UpdateRecordStepExecutor', async () => {
    const step = makePendingStep({ stepType: StepType.UpdateRecord });
    const executor = await StepExecutorFactory.create(step, makeContextConfig(), jest.fn());
    expect(executor).toBeInstanceOf(UpdateRecordStepExecutor);
  });

  it('dispatches TriggerAction steps to TriggerRecordActionStepExecutor', async () => {
    const step = makePendingStep({ stepType: StepType.TriggerAction });
    const executor = await StepExecutorFactory.create(step, makeContextConfig(), jest.fn());
    expect(executor).toBeInstanceOf(TriggerRecordActionStepExecutor);
  });

  it('dispatches LoadRelatedRecord steps to LoadRelatedRecordStepExecutor', async () => {
    const step = makePendingStep({ stepType: StepType.LoadRelatedRecord });
    const executor = await StepExecutorFactory.create(step, makeContextConfig(), jest.fn());
    expect(executor).toBeInstanceOf(LoadRelatedRecordStepExecutor);
  });

  it('dispatches McpTask steps to McpTaskStepExecutor and calls loadTools', async () => {
    const step = makePendingStep({ stepType: StepType.McpTask });
    const loadTools = jest.fn().mockResolvedValue([]);
    const executor = await StepExecutorFactory.create(step, makeContextConfig(), loadTools);
    expect(executor).toBeInstanceOf(McpTaskStepExecutor);
    expect(loadTools).toHaveBeenCalledTimes(1);
  });

  it('returns an executor with an error outcome for an unknown step type', async () => {
    const step = {
      ...makePendingStep(),
      stepDefinition: { type: 'unknown-type' as StepType },
    } as unknown as PendingStepExecution;
    const executor = await StepExecutorFactory.create(step, makeContextConfig(), jest.fn());
    const { stepOutcome } = await executor.execute();
    expect(stepOutcome.status).toBe('error');
    expect(stepOutcome.error).toBe('An unexpected error occurred.');
  });

  it('returns an executor with an error outcome when loadTools rejects for a McpTask step', async () => {
    const step = makePendingStep({ stepType: StepType.McpTask });
    const loadTools = jest.fn().mockRejectedValueOnce(new Error('MCP server down'));
    const executor = await StepExecutorFactory.create(step, makeContextConfig(), loadTools);
    const { stepOutcome } = await executor.execute();
    expect(stepOutcome.status).toBe('error');
    expect(stepOutcome.type).toBe('mcp-task');
    expect(stepOutcome.error).toBe('An unexpected error occurred.');
  });

  it('logs cause message when construction error has an Error cause', async () => {
    const rootCause = new Error('root cause');
    const error = new Error('wrapper');
    (error as Error & { cause: Error }).cause = rootCause;
    const logger = { error: jest.fn() };
    const contextConfig: StepContextConfig = {
      ...makeContextConfig(),
      aiClient: {
        getModel: jest.fn().mockImplementationOnce(() => {
          throw error;
        }),
      } as unknown as AiClient,
      logger,
    };

    await StepExecutorFactory.create(makePendingStep(), contextConfig, jest.fn());

    expect(logger.error).toHaveBeenCalledWith(
      'Step execution failed unexpectedly',
      expect.objectContaining({ cause: 'root cause' }),
    );
  });

  it('logs cause as undefined when construction error cause is not an Error instance', async () => {
    const error = new Error('wrapper');
    (error as Error & { cause: string }).cause = 'plain string';
    const logger = { error: jest.fn() };
    const contextConfig: StepContextConfig = {
      ...makeContextConfig(),
      aiClient: {
        getModel: jest.fn().mockImplementationOnce(() => {
          throw error;
        }),
      } as unknown as AiClient,
      logger,
    };

    await StepExecutorFactory.create(makePendingStep(), contextConfig, jest.fn());

    expect(logger.error).toHaveBeenCalledWith(
      'Step execution failed unexpectedly',
      expect.objectContaining({ cause: undefined }),
    );
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('reports a fallback error outcome when buildContext throws (getModel throws)', async () => {
    const workflowPort = createMockWorkflowPort();
    const mockLogger = createMockLogger();
    const aiClient = createMockAiClient();
    const step = makePendingStep({ runId: 'run-1', stepId: 'step-err' });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    aiClient.getModel.mockImplementationOnce(() => {
      throw new Error('AI not configured');
    });

    runner = new Runner(
      createRunnerConfig({
        workflowPort,
        aiClient: aiClient as unknown as AiClient,
        logger: mockLogger,
      }),
    );
    await runner.triggerPoll('run-1');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Step execution failed unexpectedly',
      expect.objectContaining({
        runId: 'run-1',
        stepId: 'step-err',
        stepIndex: 0,
        error: 'AI not configured',
      }),
    );
    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith('run-1', {
      type: 'record-task',
      stepId: 'step-err',
      stepIndex: 0,
      status: 'error',
      error: 'An unexpected error occurred.',
    });
  });

  it('reports type mcp-task in fallback error outcome for McpTask steps', async () => {
    const workflowPort = createMockWorkflowPort();
    const aiClient = createMockAiClient();
    const step = makePendingStep({
      runId: 'run-1',
      stepId: 'step-mcp-err',
      stepType: StepType.McpTask,
    });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    aiClient.getModel.mockImplementationOnce(() => {
      throw new Error('AI not configured');
    });

    runner = new Runner(
      createRunnerConfig({ workflowPort, aiClient: aiClient as unknown as AiClient }),
    );
    await runner.triggerPoll('run-1');

    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ type: 'mcp-task', status: 'error' }),
    );
  });

  it('logs unexpected errors with runId, stepId, and stack when getModel throws', async () => {
    const workflowPort = createMockWorkflowPort();
    const mockLogger = createMockLogger();
    const aiClient = createMockAiClient();
    const error = new Error('something blew up');
    const step = makePendingStep({ runId: 'run-2', stepId: 'step-log' });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    aiClient.getModel.mockImplementationOnce(() => {
      throw error;
    });

    runner = new Runner(
      createRunnerConfig({
        workflowPort,
        aiClient: aiClient as unknown as AiClient,
        logger: mockLogger,
      }),
    );
    await runner.triggerPoll('run-2');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Step execution failed unexpectedly',
      expect.objectContaining({
        runId: 'run-2',
        stepId: 'step-log',
        stepIndex: 0,
        error: 'something blew up',
        stack: expect.any(String),
      }),
    );
  });

  it('does not re-throw if updateStepExecution fails after a construction error', async () => {
    const workflowPort = createMockWorkflowPort();
    const aiClient = createMockAiClient();
    const step = makePendingStep({ runId: 'run-1', stepId: 'step-fallback' });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    aiClient.getModel.mockImplementationOnce(() => {
      throw new Error('construction error');
    });
    workflowPort.updateStepExecution.mockRejectedValueOnce(new Error('update failed'));

    runner = new Runner(
      createRunnerConfig({ workflowPort, aiClient: aiClient as unknown as AiClient }),
    );

    await expect(runner.triggerPoll('run-1')).resolves.toBeUndefined();
  });

  it('logs FATAL and does not call updateStepExecution if executor.execute() rejects', async () => {
    const workflowPort = createMockWorkflowPort();
    const mockLogger = createMockLogger();
    const step = makePendingStep({ runId: 'run-1', stepId: 'step-fatal' });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);

    // Simulate a broken executor that violates the never-throw contract
    jest.spyOn(StepExecutorFactory, 'create').mockResolvedValueOnce({
      execute: jest.fn().mockRejectedValueOnce(new Error('contract violated')),
    });

    runner = new Runner(createRunnerConfig({ workflowPort, logger: mockLogger }));
    await runner.triggerPoll('run-1');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'FATAL: executor contract violated — step outcome not reported',
      expect.objectContaining({
        runId: 'run-1',
        stepId: 'step-fatal',
        error: 'contract violated',
      }),
    );
    expect(workflowPort.updateStepExecution).not.toHaveBeenCalled();
  });

  it('reports an outcome when getModel throws a non-Error throwable', async () => {
    const workflowPort = createMockWorkflowPort();
    const aiClient = createMockAiClient();
    const step = makePendingStep({ runId: 'run-1', stepId: 'step-string-throw' });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    aiClient.getModel.mockImplementationOnce(() => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw 'plain string error';
    });

    runner = new Runner(
      createRunnerConfig({ workflowPort, aiClient: aiClient as unknown as AiClient }),
    );
    await runner.triggerPoll('run-1');

    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ status: 'error', error: 'An unexpected error occurred.' }),
    );
  });

  it('catches getPendingStepExecutions failure, logs it, and reschedules', async () => {
    const workflowPort = createMockWorkflowPort();
    const mockLogger = createMockLogger();
    workflowPort.getPendingStepExecutions
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue([]);

    runner = new Runner(createRunnerConfig({ workflowPort, logger: mockLogger }));
    await runner.start();

    jest.advanceTimersByTime(POLLING_INTERVAL_MS);
    await flushPromises();

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Poll cycle failed',
      expect.objectContaining({ error: 'network error' }),
    );

    // After the error, the cycle should have been rescheduled
    jest.advanceTimersByTime(POLLING_INTERVAL_MS);
    await flushPromises();

    expect(workflowPort.getPendingStepExecutions).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// getRunStepExecutions
// ---------------------------------------------------------------------------

describe('getRunStepExecutions', () => {
  it('delegates to runStore.getStepExecutions and returns the result', async () => {
    const steps = [{ type: 'condition' as const, stepIndex: 0 }];
    const runStore = createMockRunStore({
      getStepExecutions: jest.fn().mockResolvedValue(steps),
    });
    runner = new Runner(createRunnerConfig({ runStore }));

    const result = await runner.getRunStepExecutions('run-1');

    expect(result).toEqual(steps);
    expect(runStore.getStepExecutions).toHaveBeenCalledWith('run-1');
  });
});

// ---------------------------------------------------------------------------
// triggerPoll with options (bearerUserId, pendingData)
// ---------------------------------------------------------------------------

describe('triggerPoll with options', () => {
  it('succeeds when bearerUserId matches step.user.id', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1' }); // user.id = 1
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);

    runner = new Runner(createRunnerConfig({ workflowPort }));
    await expect(runner.triggerPoll('run-1', { bearerUserId: 1 })).resolves.toBeUndefined();

    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('throws UserMismatchError when bearerUserId does not match step.user.id', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1' }); // user.id = 1
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);

    runner = new Runner(createRunnerConfig({ workflowPort }));

    await expect(runner.triggerPoll('run-1', { bearerUserId: 999 })).rejects.toThrow(
      UserMismatchError,
    );
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('skips user check when bearerUserId is undefined', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1' });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);

    runner = new Runner(createRunnerConfig({ workflowPort }));
    await expect(runner.triggerPoll('run-1', {})).resolves.toBeUndefined();

    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('patches pending data then executes when pendingData is provided', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1', stepIndex: 0 });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);

    const runStore = createMockRunStore({
      getStepExecutions: jest.fn().mockResolvedValue([
        {
          type: 'update-record',
          stepIndex: 0,
          pendingData: { fieldName: 'status', value: 'old' },
        },
      ]),
    });
    runner = new Runner(createRunnerConfig({ workflowPort, runStore }));

    await runner.triggerPoll('run-1', { pendingData: { userConfirmed: true, value: 'new' } });

    expect(runStore.saveStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        pendingData: { fieldName: 'status', value: 'new', userConfirmed: true },
      }),
    );
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('throws PendingDataNotFoundError when step is not found', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1', stepIndex: 0 });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    const runStore = createMockRunStore({ getStepExecutions: jest.fn().mockResolvedValue([]) });
    runner = new Runner(createRunnerConfig({ workflowPort, runStore }));

    await expect(
      runner.triggerPoll('run-1', { pendingData: { userConfirmed: true } }),
    ).rejects.toThrow(PendingDataNotFoundError);
  });

  it('throws PendingDataNotFoundError when step has no pendingData', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1', stepIndex: 0 });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    const runStore = createMockRunStore({
      getStepExecutions: jest.fn().mockResolvedValue([{ type: 'update-record', stepIndex: 0 }]),
    });
    runner = new Runner(createRunnerConfig({ workflowPort, runStore }));

    await expect(
      runner.triggerPoll('run-1', { pendingData: { userConfirmed: true } }),
    ).rejects.toThrow(PendingDataNotFoundError);
  });

  it('throws PendingDataNotFoundError when step type has no schema (e.g. condition)', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1', stepIndex: 0 });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    const runStore = createMockRunStore({
      getStepExecutions: jest.fn().mockResolvedValue([{ type: 'condition', stepIndex: 0 }]),
    });
    runner = new Runner(createRunnerConfig({ workflowPort, runStore }));

    await expect(
      runner.triggerPoll('run-1', { pendingData: { userConfirmed: true } }),
    ).rejects.toThrow(PendingDataNotFoundError);
  });

  it('throws InvalidPendingDataError with mapped issues when body fails Zod validation', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1', stepIndex: 0 });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    const runStore = createMockRunStore({
      getStepExecutions: jest.fn().mockResolvedValue([
        {
          type: 'update-record',
          stepIndex: 0,
          pendingData: { fieldName: 'status', value: 'active' },
        },
      ]),
    });
    runner = new Runner(createRunnerConfig({ workflowPort, runStore }));

    const error = await runner
      .triggerPoll('run-1', { pendingData: { userConfirmed: 'yes' } })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InvalidPendingDataError);
    expect((error as InvalidPendingDataError).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['userConfirmed'], code: expect.any(String) }),
      ]),
    );
  });

  it('throws InvalidPendingDataError when body contains unknown fields', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1', stepIndex: 0 });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    const runStore = createMockRunStore({
      getStepExecutions: jest
        .fn()
        .mockResolvedValue([
          { type: 'trigger-action', stepIndex: 0, pendingData: { name: 'send_email' } },
        ]),
    });
    runner = new Runner(createRunnerConfig({ workflowPort, runStore }));

    await expect(
      runner.triggerPoll('run-1', {
        pendingData: { userConfirmed: true, extra: 'field' },
      }),
    ).rejects.toThrow(InvalidPendingDataError);
  });

  it('update-record: merges value override into pendingData and calls saveStepExecution', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1', stepIndex: 0 });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    const existing = {
      type: 'update-record' as const,
      stepIndex: 0,
      pendingData: { fieldName: 'status', value: 'old_value' },
    };
    const runStore = createMockRunStore({
      getStepExecutions: jest.fn().mockResolvedValue([existing]),
    });
    runner = new Runner(createRunnerConfig({ workflowPort, runStore }));

    await runner.triggerPoll('run-1', {
      pendingData: { userConfirmed: true, value: 'new_value' },
    });

    expect(runStore.saveStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        type: 'update-record',
        stepIndex: 0,
        pendingData: { fieldName: 'status', value: 'new_value', userConfirmed: true },
      }),
    );
  });

  it('load-related-record: merges selectedRecordId override correctly', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1', stepIndex: 1 });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    const existing = {
      type: 'load-related-record' as const,
      stepIndex: 1,
      pendingData: {
        name: 'order',
        displayName: 'Order',
        selectedRecordId: [99],
        suggestedFields: [],
      },
      selectedRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
    };
    const runStore = createMockRunStore({
      getStepExecutions: jest.fn().mockResolvedValue([existing]),
    });
    runner = new Runner(createRunnerConfig({ workflowPort, runStore }));

    await runner.triggerPoll('run-1', {
      pendingData: { userConfirmed: true, selectedRecordId: ['42'] },
    });

    expect(runStore.saveStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        pendingData: expect.objectContaining({ selectedRecordId: ['42'], userConfirmed: true }),
      }),
    );
  });

  it('trigger-action: merges userConfirmed:true only, rejects extra field', async () => {
    const workflowPort = createMockWorkflowPort();
    const step = makePendingStep({ runId: 'run-1', stepIndex: 0 });
    workflowPort.getPendingStepExecutionsForRun.mockResolvedValue(step);
    const existing = {
      type: 'trigger-action' as const,
      stepIndex: 0,
      pendingData: { name: 'send_email', displayName: 'Send Email' },
    };
    const runStore = createMockRunStore({
      getStepExecutions: jest.fn().mockResolvedValue([existing]),
    });
    runner = new Runner(createRunnerConfig({ workflowPort, runStore }));

    await runner.triggerPoll('run-1', { pendingData: { userConfirmed: true } });

    expect(runStore.saveStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        pendingData: expect.objectContaining({ userConfirmed: true }),
      }),
    );

    await expect(
      runner.triggerPoll('run-1', {
        pendingData: { userConfirmed: true, name: 'override' },
      }),
    ).rejects.toThrow(InvalidPendingDataError);
  });
});
