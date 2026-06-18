import type { ExecutionContext, StepExecutionResult } from '../types/execution-context';
import type { McpStepExecutionData, McpToolCall } from '../types/step-execution-data';
import type { McpStepDefinition } from '../types/validated/step-definition';
import type { RecordStepStatus } from '../types/validated/step-outcome';
import type { RemoteTool, StructuredToolInterface } from '@forestadmin/ai-proxy';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  McpToolInvocationError,
  McpToolNotFoundError,
  NoMcpToolsError,
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

  constructor(
    context: ExecutionContext<McpStepDefinition>,
    remoteTools: readonly RemoteTool[],
    mcpServerName?: string,
  ) {
    super(context);
    this.remoteTools = remoteTools;
    this.mcpServerName = mcpServerName;
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
    // Branch A -- Re-entry after pending execution found in RunStore
    const pending = await this.patchAndReloadPendingData<McpStepExecutionData>(
      this.context.incomingPendingData,
    );

    if (pending) {
      return this.handleConfirmationFlow<McpStepExecutionData>(pending, execution =>
        this.executeToolAndPersist(execution.pendingData as McpToolCall, execution),
      );
    }

    // Branches B & C -- First call
    const tools = this.requireTools();
    const { toolName, args, reasoning } = await this.selectTool(tools);
    const selectedTool = tools.find(t => t.base.name === toolName);
    if (!selectedTool) throw new McpToolNotFoundError(toolName);
    const target: McpToolCall = { name: toolName, sourceId: selectedTool.sourceId, input: args };

    if (this.context.stepDefinition.executionType === StepExecutionMode.FullyAutomated) {
      // Branch B -- direct execution
      return this.executeToolAndPersist(target, undefined, reasoning);
    }

    // Branch C -- Awaiting confirmation
    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'mcp',
      stepIndex: this.context.stepIndex,
      pendingData: target,
      toolSelectionReasoning: reasoning,
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
        operation: async () => {
          try {
            return await tool.base.invoke(target.input);
          } catch (cause) {
            throw new McpToolInvocationError(target.name, cause);
          }
        },
        beforeCall: () =>
          this.context.runStore.saveStepExecution(this.context.runId, {
            ...existingExecution,
            type: 'mcp',
            stepIndex: this.context.stepIndex,
            idempotencyPhase: 'executing',
          }),
      },
    );

    // 1. Persist raw result immediately — safe state before any further network calls
    const baseExecutionResult = { success: true as const, toolResult };
    const baseData: McpStepExecutionData = {
      ...existingExecution,
      type: 'mcp',
      stepIndex: this.context.stepIndex,
      toolSelectionReasoning: reasoning ?? existingExecution?.toolSelectionReasoning,
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

    const { toolName, args } = await this.invokeWithTools<Record<string, unknown>>(
      messages,
      tools.map(t => McpStepExecutor.withReasoningField(t.base)),
    );

    const { [REASONING_FIELD]: reasoning, ...input } = args;
    const toolSelectionReasoning = typeof reasoning === 'string' ? reasoning : undefined;

    this.context.logger('Info', 'MCP tool selected', {
      ...this.logCtx,
      toolName,
      reasoning: toolSelectionReasoning,
    });

    return { toolName, args: input, reasoning: toolSelectionReasoning };
  }

  // Wraps a tool's schema with a top-level `reasoning` field so the model explains its choice in
  // the same forced tool call. Handles both zod schemas (Forest connectors) and JSON Schema (MCP
  // servers). The original tool — invoked later — keeps its untouched schema.
  private static withReasoningField(tool: StructuredToolInterface): DynamicStructuredTool {
    const { schema } = tool;
    const isZodObject = typeof (schema as { extend?: unknown }).extend === 'function';
    const augmented: z.ZodTypeAny = isZodObject
      ? (schema as z.ZodObject<z.ZodRawShape>).extend({
          [REASONING_FIELD]: z.string().describe(REASONING_FIELD_DESCRIPTION),
        })
      : // Dynamic JSON-Schema tools (MCP servers) are valid at runtime but don't unify under
        // langchain's static schema union.
        (McpStepExecutor.injectReasoningIntoJsonSchema(
          schema as JsonSchemaObject,
        ) as unknown as z.ZodTypeAny);

    return new DynamicStructuredTool({
      name: tool.name,
      description: tool.description,
      schema: augmented,
      func: undefined,
    });
  }

  private static injectReasoningIntoJsonSchema(schema: JsonSchemaObject): JsonSchemaObject {
    return {
      ...schema,
      properties: {
        ...(schema.properties ?? {}),
        [REASONING_FIELD]: { type: 'string', description: REASONING_FIELD_DESCRIPTION },
      },
      required: Array.from(new Set([...(schema.required ?? []), REASONING_FIELD])),
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
