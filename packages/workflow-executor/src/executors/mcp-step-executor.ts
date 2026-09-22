import type { ExecutionContext, StepExecutionResult } from '../types/execution-context';
import type { McpStepExecutionData, McpToolCall } from '../types/step-execution-data';
import type { McpStepDefinition } from '../types/validated/step-definition';
import type {
  AwaitingInputReason,
  ErrorKind,
  RecordStepStatus,
} from '../types/validated/step-outcome';
import type { RemoteTool, StructuredToolInterface } from '@forestadmin/ai-proxy';

import {
  DynamicStructuredTool,
  HumanMessage,
  SystemMessage,
  isMcpAuthError,
} from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  McpToolInvocationError,
  McpToolNotFoundError,
  NoMcpToolsError,
  OAuthReauthRequiredError,
  StepStateError,
} from '../errors';
import BaseStepExecutor from './base-step-executor';
import { StepExecutionMode } from '../types/validated/step-definition';

const MCP_TASK_SYSTEM_PROMPT = `You are an AI agent selecting and executing a tool to fulfill a user request.
Select the most appropriate tool and fill in its parameters precisely.

Important rules:
- Select only the tool directly relevant to the request.
- Always populate the "reasoning" field, explaining in passive voice why the chosen tool fits the request better than the alternatives.
- Final answer is definitive, you won't receive any other input from the user.`;

const REASONING_FIELD = 'reasoning';
// Tool schemas come from arbitrary customer MCP servers, so `reasoning` is not ours to reserve:
// a tool declaring its own keeps it, and the justification is asked for under this name instead.
const FALLBACK_REASONING_FIELD = '__forest_tool_selection_reasoning';
const REASONING_FIELD_DESCRIPTION =
  'Concise explanation of why this tool was selected over the others, in passive voice.';

type JsonSchemaObject = {
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

export default class McpStepExecutor extends BaseStepExecutor<McpStepDefinition> {
  private readonly remoteTools: readonly RemoteTool[];

  private readonly mcpServerName?: string;

  private readonly reloadWithFreshAuth?: () => Promise<RemoteTool[]>;

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

  // Keep a confirmation-flow record's approved pendingData (clear only the marker) so resume replays
  // it; delete a pendingData-less record, which would otherwise mis-route resume into confirmation.
  private async clearReauthPauseState(): Promise<void> {
    const existing = await this.findPendingExecution<McpStepExecutionData>('mcp');
    if (!existing) return;

    if (existing.pendingData) {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        ...existing,
        idempotencyPhase: undefined,
      });
    } else {
      await this.context.runStore.deleteStepExecution(this.context.runId, this.context.stepIndex);
    }
  }

  private async runStep(): Promise<StepExecutionResult> {
    const pending = await this.patchAndReloadPendingData<McpStepExecutionData>(
      this.context.incomingPendingData,
    );

    if (pending) {
      return this.handleConfirmationFlow<McpStepExecutionData>(pending, execution =>
        this.executeToolAndPersist(execution.pendingData as McpToolCall, execution),
      );
    }

    const tools = this.requireTools();
    const { toolName, args, reasoning } = await this.selectTool(tools);
    const selectedTool = tools.find(t => t.base.name === toolName);
    if (!selectedTool) throw new McpToolNotFoundError(toolName);
    const target: McpToolCall = { name: toolName, sourceId: selectedTool.sourceId, input: args };

    if (this.context.stepDefinition.executionType === StepExecutionMode.FullyAutomated) {
      return this.executeToolAndPersist(target, undefined, reasoning);
    }

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'mcp',
      stepIndex: this.context.stepIndex,
      pendingData: target,
      ...(reasoning !== undefined && { toolSelectionReasoning: reasoning }),
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  private async executeToolAndPersist(
    target: McpToolCall,
    existingExecution?: McpStepExecutionData,
    reasoning?: string,
  ): Promise<StepExecutionResult> {
    const tools = this.requireTools();
    const tool = tools.find(t => t.base.name === target.name && t.sourceId === target.sourceId);
    if (!tool) throw new McpToolNotFoundError(target.name);

    const toolResult = await this.context.activityLog.track(
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
            ...existingExecution,
            type: 'mcp',
            stepIndex: this.context.stepIndex,
            ...(reasoning !== undefined && { toolSelectionReasoning: reasoning }),
            executionParams: { name: target.name, sourceId: target.sourceId, input: target.input },
            idempotencyPhase: 'executing',
          }),
      },
    );

    // 1. Persist raw result immediately — safe state before any further network calls
    const baseExecutionResult = { success: true as const, toolResult };
    const toolSelectionReasoning = reasoning ?? existingExecution?.toolSelectionReasoning;
    const baseData: McpStepExecutionData = {
      ...existingExecution,
      type: 'mcp',
      stepIndex: this.context.stepIndex,
      ...(toolSelectionReasoning !== undefined && { toolSelectionReasoning }),
      executionParams: { name: target.name, sourceId: target.sourceId, input: target.input },
      executionResult: baseExecutionResult,
      idempotencyPhase: 'done',
    };

    await this.context.runStore.saveStepExecution(this.context.runId, baseData);

    // 2. AI formatting — non-blocking; errors are logged but do not fail the step
    let formattedResponse: string | null = null;

    try {
      formattedResponse = await this.formatToolResult(target, toolResult);
    } catch (cause) {
      this.context.logger(
        'Error',
        'Failed to format MCP tool result, persisting raw result without summary',
        {
          runId: this.context.runId,
          stepIndex: this.context.stepIndex,
          toolName: target.name,
          cause: cause instanceof Error ? cause.message : String(cause),
        },
      );
    }

    if (formattedResponse) {
      try {
        await this.context.runStore.saveStepExecution(this.context.runId, {
          ...baseData,
          executionResult: { ...baseExecutionResult, formattedResponse },
        });
      } catch (cause) {
        this.context.logger(
          'Error',
          'MCP tool result formatted but enriched state could not be persisted',
          {
            runId: this.context.runId,
            stepIndex: this.context.stepIndex,
            toolName: target.name,
            cause: cause instanceof Error ? cause.message : String(cause),
          },
        );
      }
    }

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

  private async formatToolResult(tool: McpToolCall, toolResult: unknown): Promise<string | null> {
    if (toolResult === null || toolResult === undefined) return null;

    const resultStr = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
    const truncatedResult =
      resultStr.length > 20_000 ? `${resultStr.slice(0, 20_000)}\n... [truncated]` : resultStr;

    const summaryTool = new DynamicStructuredTool({
      name: 'summarize-result',
      description: 'Provides a human-readable summary of the tool execution result.',
      schema: z.object({
        summary: z.string().min(1).describe('Concise human-readable summary of the tool result.'),
      }),
      func: undefined,
    });

    const messages = [
      this.buildContextMessage(),
      new SystemMessage(
        'You are summarizing the result of a workflow tool execution for the end user. ' +
          'Be concise and factual. Do not include raw JSON or technical identifiers.',
      ),
      new HumanMessage(
        `Tool "${tool.name}" was executed with input: ${JSON.stringify(tool.input)}.\n` +
          `Result: ${truncatedResult}\n\n` +
          `Provide a concise human-readable summary.`,
      ),
    ];

    const { summary } = await this.invokeWithTool<{ summary: string }>(messages, summaryTool);

    return summary || null;
  }

  private async selectTool(tools: RemoteTool[]) {
    const messages = [
      this.buildContextMessage(),
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(MCP_TASK_SYSTEM_PROMPT),
      new HumanMessage(
        `**Request**: ${this.context.stepDefinition.prompt ?? 'Execute the relevant tool.'}`,
      ),
    ];

    const reasoningKeys = new Map<string, string>();
    const augmentedTools = tools.map(t => {
      const { tool, reasoningKey } = McpStepExecutor.withReasoningField(t.base);
      reasoningKeys.set(t.base.name, reasoningKey);

      return tool;
    });

    const { toolName, args } = await this.invokeWithTools<Record<string, unknown>>(
      messages,
      augmentedTools,
    );

    const { [reasoningKeys.get(toolName) ?? REASONING_FIELD]: reasoning, ...input } = args;

    return {
      toolName,
      args: input,
      reasoning: typeof reasoning === 'string' ? reasoning : undefined,
    };
  }

  // A tool's schema is duck-typed rather than matched with `instanceof`: ai-proxy and
  // workflow-executor resolve different zod instances, and an MCP-server tool carries a plain
  // JSON Schema, which is valid at runtime but does not unify with langchain's static union.
  private static withReasoningField(tool: StructuredToolInterface): {
    tool: DynamicStructuredTool;
    reasoningKey: string;
  } {
    const { schema } = tool;
    const isZodObject = typeof (schema as { extend?: unknown }).extend === 'function';
    const declaredKeys = isZodObject
      ? Object.keys((schema as z.ZodObject<z.ZodRawShape>).shape)
      : Object.keys((schema as JsonSchemaObject).properties ?? {});
    const reasoningKey = declaredKeys.includes(REASONING_FIELD)
      ? FALLBACK_REASONING_FIELD
      : REASONING_FIELD;

    const augmented: z.ZodTypeAny = isZodObject
      ? (schema as z.ZodObject<z.ZodRawShape>).extend({
          [reasoningKey]: z.string().describe(REASONING_FIELD_DESCRIPTION),
        })
      : (McpStepExecutor.injectReasoningIntoJsonSchema(
          schema as JsonSchemaObject,
          reasoningKey,
        ) as unknown as z.ZodTypeAny);

    return {
      tool: new DynamicStructuredTool({
        name: tool.name,
        description: tool.description,
        schema: augmented,
        func: undefined,
      }),
      reasoningKey,
    };
  }

  private static injectReasoningIntoJsonSchema(
    schema: JsonSchemaObject,
    reasoningKey: string,
  ): JsonSchemaObject {
    return {
      ...schema,
      properties: {
        ...(schema.properties ?? {}),
        [reasoningKey]: { type: 'string', description: REASONING_FIELD_DESCRIPTION },
      },
      required: Array.from(new Set([...(schema.required ?? []), reasoningKey])),
    };
  }

  // Tools are pre-scoped to step.mcpServerId upstream. An empty list means either no config
  // matched, or the per-server connection failed at load time (McpClient swallows per-server
  // errors). RemoteToolFetcher emits the diagnostic upstream; here we just surface the empty
  // case as a domain error so BaseStepExecutor turns it into a step outcome.
  private requireTools(): RemoteTool[] {
    if (this.remoteTools.length === 0) {
      throw new NoMcpToolsError(this.context.stepDefinition.mcpServerId);
    }

    return [...this.remoteTools];
  }
}
