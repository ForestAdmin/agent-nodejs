import type { ExecutionContext, StepExecutionResult } from '../types/execution-context';
import type {
  McpExecutedToolCall,
  McpStepExecutionData,
  McpToolCall,
} from '../types/step-execution-data';
import type { McpStepDefinition } from '../types/validated/step-definition';
import type {
  AwaitingInputReason,
  ErrorKind,
  RecordStepStatus,
} from '../types/validated/step-outcome';
import type { RemoteTool } from '@forestadmin/ai-proxy';

import {
  DynamicStructuredTool,
  HumanMessage,
  SystemMessage,
  isMcpAuthError,
} from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  McpToolCallLimitError,
  McpToolInvocationError,
  McpToolNotFoundError,
  McpToolsNotAllowedError,
  NoMcpToolsError,
  OAuthReauthRequiredError,
  StepStateError,
  StepTimeoutError,
} from '../errors';
import BaseStepExecutor from './base-step-executor';
import { StepExecutionMode } from '../types/validated/step-definition';

const MAX_TOOL_CALLS = 10;
// Caps each result, not the total: every decision replays all of the step's results, so up to
// MAX_TOOL_CALLS × 20k characters. Cap the total if a model's context window falls short.
const MAX_RESULT_LENGTH = 20_000;

const COMPLETE_STEP_TOOL = new DynamicStructuredTool({
  name: 'complete-step',
  description:
    'Ends the step with the final answer for the user. Call it once the request is fulfilled, ' +
    'or when no further tool call can help.',
  schema: z.object({
    summary: z
      .string()
      .min(1)
      .describe('Concise human-readable answer: what was done and what was found.'),
  }),
  func: undefined,
});

const MCP_TASK_SYSTEM_PROMPT = `You are an AI agent fulfilling a user request by calling the tools available to you.
Call one tool at a time and fill in its parameters precisely. The result of every call is shown to you before you choose the next one.

Important rules:
- Call only the tools directly relevant to the request.
- You can make at most ${MAX_TOOL_CALLS} tool calls.
- Once the request is fulfilled, or no further tool call can help, call "${COMPLETE_STEP_TOOL.name}" with a concise answer for the user. Be factual and do not include raw JSON or technical identifiers.
- Final answer is definitive, you won't receive any other input from the user.`;

function formatResultForAi(result: unknown): string {
  const text = typeof result === 'string' ? result : String(JSON.stringify(result));

  return text.length > MAX_RESULT_LENGTH
    ? `${text.slice(0, MAX_RESULT_LENGTH)}\n... [truncated]`
    : text;
}

export default class McpStepExecutor extends BaseStepExecutor<McpStepDefinition> {
  private readonly remoteTools: readonly RemoteTool[];

  private readonly mcpServerName?: string;

  private readonly reloadWithFreshAuth?: () => Promise<RemoteTool[]>;

  private allowedRemoteTools?: RemoteTool[];

  private deadline?: number;

  constructor(
    context: ExecutionContext<McpStepDefinition>,
    remoteTools: readonly RemoteTool[],
    mcpServerName?: string,
    reloadWithFreshAuth?: () => Promise<RemoteTool[]>,
  ) {
    super(context);
    this.remoteTools = remoteTools;
    this.mcpServerName = mcpServerName;
    this.reloadWithFreshAuth = reloadWithFreshAuth;
  }

  protected override getExtraLogContext(): Record<string, unknown> {
    return {
      mcpServerId: this.context.stepDefinition.mcpServerId,
      mcpServerName: this.mcpServerName,
    };
  }

  protected buildOutcomeResult(outcome: {
    status: RecordStepStatus;
    error?: string;
    errorKind?: ErrorKind;
    errorSourceStepIndex?: number;
    awaitingInputReason?: AwaitingInputReason;
  }): StepExecutionResult {
    return {
      stepOutcome: {
        type: 'mcp',
        stepId: this.context.stepId,
        stepIndex: this.context.stepIndex,
        ...outcome,
      },
    };
  }

  protected override async checkIdempotency(): Promise<StepExecutionResult | null> {
    const existing = await this.findPendingExecution<McpStepExecutionData>('mcp');

    if (existing?.idempotencyPhase === 'done') {
      return this.buildOutcomeResult({ status: 'success' });
    }

    if (existing?.idempotencyPhase === 'executing') {
      throw new StepStateError('Step execution was interrupted. Please retry the step manually.');
    }

    return null;
  }

  protected async doExecute(): Promise<StepExecutionResult> {
    const { stepTimeoutS } = this.context;
    if (stepTimeoutS && stepTimeoutS > 0) this.deadline = Date.now() + stepTimeoutS * 1000;

    try {
      return await this.runStep();
    } catch (error) {
      // An unrefreshable OAuth credential pauses the step for re-authentication rather than failing
      // it. Clear the write-ahead marker so the resumed step is not rejected as interrupted.
      if (error instanceof OAuthReauthRequiredError) {
        await this.clearReauthPauseState();

        return this.buildOutcomeResult({
          status: 'awaiting-input',
          awaitingInputReason: error.awaitingInputReason,
        });
      }

      throw error;
    }
  }

  // Keep a record carrying an approved call or completed calls (clear only the marker) so resume
  // replays or continues from them; delete an empty one, which would mis-route resume into confirmation.
  private async clearReauthPauseState(): Promise<void> {
    const existing = await this.findPendingExecution<McpStepExecutionData>('mcp');
    if (!existing) return;

    if (existing.pendingData || existing.toolCalls?.length) {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        ...existing,
        idempotencyPhase: undefined,
      });
    } else {
      await this.context.runStore.deleteStepExecution(this.context.runId, this.context.stepIndex);
    }
  }

  private async runStep(): Promise<StepExecutionResult> {
    const execution = await this.patchAndReloadPendingData<McpStepExecutionData>(
      this.context.incomingPendingData,
    );

    // Only a re-authentication pause leaves completed calls with none pending: carry on from them.
    if (execution?.toolCalls?.length && !execution.pendingData) {
      return this.continueLoop(execution);
    }

    if (execution) {
      return this.handleConfirmationFlow<McpStepExecutionData>(execution, async accepted =>
        this.continueLoop(await this.executeCall(accepted.pendingData as McpToolCall, accepted)),
      );
    }

    return this.continueLoop({ type: 'mcp', stepIndex: this.context.stepIndex, toolCalls: [] });
  }

  // The base reports a timeout without cancelling this work, so the loop stops itself: a step
  // already reported as timed out must not go on calling tools in the background.
  private throwIfTimedOut(): void {
    if (this.deadline !== undefined && Date.now() >= this.deadline) {
      throw new StepTimeoutError(this.context.stepTimeoutS as number);
    }
  }

  private async continueLoop(execution: McpStepExecutionData): Promise<StepExecutionResult> {
    this.throwIfTimedOut();
    const toolCalls = execution.toolCalls ?? [];
    const next = await this.selectNextMove(toolCalls);

    if ('summary' in next) return this.persistFinalAnswer(execution, toolCalls, next.summary);
    if (toolCalls.length >= MAX_TOOL_CALLS) throw new McpToolCallLimitError(MAX_TOOL_CALLS);

    if (this.context.stepDefinition.executionType === StepExecutionMode.FullyAutomated) {
      return this.continueLoop(await this.executeCall(next, execution));
    }

    // A fresh confirmation for the next call: the previous one must not approve it.
    await this.context.runStore.saveStepExecution(this.context.runId, {
      ...execution,
      toolCalls,
      pendingData: next,
      userConfirmation: undefined,
      idempotencyPhase: undefined,
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  private async executeCall(
    target: McpToolCall,
    execution: McpStepExecutionData,
  ): Promise<McpStepExecutionData> {
    this.throwIfTimedOut();
    const tools = this.requireTools();
    const tool = tools.find(t => t.base.name === target.name && t.sourceId === target.sourceId);
    if (!tool) throw new McpToolNotFoundError(target.name);

    const result = await this.context.activityLog.track(
      {
        action: 'action',
        type: 'write',
        label: this.context.stepDefinition.mcpServerId,
        collectionId: this.context.collectionId,
        recordId: this.context.baseRecordRef.recordId,
      },
      {
        operation: () => this.invokeWithReauthRetry(tool, target),
        beforeCall: () =>
          this.context.runStore.saveStepExecution(this.context.runId, {
            ...execution,
            idempotencyPhase: 'executing',
          }),
      },
    );

    const { name, sourceId, input } = target;
    const executed: McpStepExecutionData = {
      ...execution,
      toolCalls: [...(execution.toolCalls ?? []), { name, sourceId, input, result }],
      idempotencyPhase: 'executing',
    };

    await this.context.runStore.saveStepExecution(this.context.runId, executed);

    return executed;
  }

  private async persistFinalAnswer(
    execution: McpStepExecutionData,
    toolCalls: McpExecutedToolCall[],
    summary: string,
  ): Promise<StepExecutionResult> {
    const lastCall = toolCalls[toolCalls.length - 1];

    await this.context.runStore.saveStepExecution(this.context.runId, {
      ...execution,
      toolCalls,
      ...(lastCall && {
        executionParams: {
          name: lastCall.name,
          sourceId: lastCall.sourceId,
          input: lastCall.input,
        },
      }),
      executionResult: {
        success: true,
        toolResult: lastCall?.result ?? null,
        ...(summary && { formattedResponse: summary }),
      },
      idempotencyPhase: 'done',
    });

    return this.buildOutcomeResult({ status: 'success' });
  }

  // No-op for bearer/none steps (no reloadWithFreshAuth). For an OAuth2 step, a 401 on the call means
  // the token was rejected after listing tools succeeded: force one refresh, rebuild the tool, retry
  // once. A second 401 pauses the step for re-authentication.
  private async invokeWithReauthRetry(tool: RemoteTool, target: McpToolCall): Promise<unknown> {
    try {
      return await tool.base.invoke(target.input);
    } catch (cause) {
      if (!this.reloadWithFreshAuth || !isMcpAuthError(cause)) {
        throw new McpToolInvocationError(target.name, cause);
      }

      let refreshedTools: RemoteTool[];

      try {
        refreshedTools = await this.reloadWithFreshAuth();
      } catch (refreshError) {
        // A non-auth refresh failure means nothing ran (the first call was a rejected 401), so clear
        // the write-ahead marker to keep the step retryable; OAuthReauthRequiredError still pauses.
        if (!(refreshError instanceof OAuthReauthRequiredError)) {
          await this.clearReauthPauseState();
        }

        throw refreshError;
      }

      const refreshedTool = refreshedTools.find(
        t => t.base.name === target.name && t.sourceId === target.sourceId,
      );

      if (!refreshedTool) {
        // The 401 first call never ran and the reload yielded no tool (empty on a connection
        // failure), so clear the marker to keep the step retryable rather than wedged.
        await this.clearReauthPauseState();

        throw new McpToolNotFoundError(target.name);
      }

      try {
        return await refreshedTool.base.invoke(target.input);
      } catch (retryCause) {
        if (isMcpAuthError(retryCause)) {
          throw new OAuthReauthRequiredError(this.context.stepDefinition.mcpServerId);
        }

        throw new McpToolInvocationError(target.name, retryCause);
      }
    }
  }

  private async selectNextMove(
    toolCalls: McpExecutedToolCall[],
  ): Promise<McpToolCall | { summary: string }> {
    const tools = this.requireTools();
    const messages = [
      this.buildContextMessage(),
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(MCP_TASK_SYSTEM_PROMPT),
      new HumanMessage(this.buildRequest(toolCalls)),
    ];

    const { toolName, args } = await this.invokeWithTools(messages, [
      ...tools.map(t => t.base),
      COMPLETE_STEP_TOOL,
    ]);

    if (toolName === COMPLETE_STEP_TOOL.name) {
      return { summary: typeof args.summary === 'string' ? args.summary : '' };
    }

    const selectedTool = tools.find(t => t.base.name === toolName);
    if (!selectedTool) throw new McpToolNotFoundError(toolName);

    return { name: toolName, sourceId: selectedTool.sourceId, input: args };
  }

  private buildRequest(toolCalls: McpExecutedToolCall[]): string {
    const request = `**Request**: ${
      this.context.stepDefinition.prompt ?? 'Execute the relevant tool.'
    }`;
    if (!toolCalls.length) return request;

    const calls = toolCalls.map(
      (call, i) =>
        `${i + 1}. "${call.name}" with input ${JSON.stringify(call.input)}\n` +
        `Result: ${formatResultForAi(call.result)}`,
    );

    return `${request}\n\n**Tool calls already made in this step** (oldest first):\n${calls.join(
      '\n\n',
    )}`;
  }

  // Tools are pre-scoped to step.mcpServerId upstream. An empty list means either no config
  // matched, or the per-server connection failed at load time (McpClient swallows per-server
  // errors). RemoteToolFetcher emits the diagnostic upstream; here we just surface the empty
  // case as a domain error so BaseStepExecutor turns it into a step outcome.
  private requireTools(): RemoteTool[] {
    if (this.remoteTools.length === 0) {
      throw new NoMcpToolsError(this.context.stepDefinition.mcpServerId);
    }

    // Filtered once per execution: the FullyAutomated path asks twice, and warns only once.
    this.allowedRemoteTools ??= this.filterAllowedTools();

    return [...this.allowedRemoteTools];
  }

  private filterAllowedTools(): RemoteTool[] {
    const { allowedTools, mcpServerId } = this.context.stepDefinition;
    if (!allowedTools?.length) return [...this.remoteTools];

    // sanitizedName is lossy (`a.b` and `a:b` both read `a_b`): an entry naming several loaded tools
    // cannot say which one was allowed, so it allows none of them rather than all.
    const matched = allowedTools.filter(
      name => this.remoteTools.filter(t => t.sanitizedName === name).length === 1,
    );
    const tools = this.remoteTools.filter(t => matched.includes(t.sanitizedName));
    if (tools.length === 0) throw new McpToolsNotAllowedError(mcpServerId, allowedTools);

    // A per-user OAuth listing can return a subset, so a partial match runs, but traced: the model
    // must call a bound tool, so a renamed allowed tool silently becomes a different one.
    const unmatchedAllowedTools = allowedTools.filter(name => !matched.includes(name));

    if (unmatchedAllowedTools.length > 0) {
      this.context.logger(
        'Warn',
        'MCP step allow-list names tools that match no single loaded tool',
        {
          ...this.logCtx,
          unmatchedAllowedTools,
        },
      );
    }

    return tools;
  }
}
