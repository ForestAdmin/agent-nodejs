import type { ExecutionContext, StepExecutionResult } from '../types/execution';
import type { McpTaskStepDefinition } from '../types/step-definition';
import type { McpTaskStepExecutionData, McpToolCall } from '../types/step-execution-data';
import type { RemoteTool } from '@forestadmin/ai-proxy';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  McpToolInvocationError,
  McpToolNotFoundError,
  NoMcpToolsError,
  StepPersistenceError,
} from '../errors';
import RecordTaskStepExecutor from './record-task-step-executor';

const MCP_TASK_SYSTEM_PROMPT = `You are an AI agent selecting and executing a tool to fulfill a user request.
Select the most appropriate tool and fill in its parameters precisely.

Important rules:
- Select only the tool directly relevant to the request.
- Final answer is definitive, you won't receive any other input from the user.`;

export default class McpTaskStepExecutor extends RecordTaskStepExecutor<McpTaskStepDefinition> {
  private readonly remoteTools: readonly RemoteTool[];

  constructor(
    context: ExecutionContext<McpTaskStepDefinition>,
    remoteTools: readonly RemoteTool[],
  ) {
    super(context);
    this.remoteTools = remoteTools;
  }

  protected async doExecute(): Promise<StepExecutionResult> {
    if (this.context.userConfirmed !== undefined) {
      // Branch A -- Re-entry with user confirmation
      return this.handleConfirmationFlow<McpTaskStepExecutionData>('mcp-task', execution =>
        this.executeToolAndPersist(execution.pendingData as McpToolCall, execution),
      );
    }

    // Branches B & C -- First call
    const tools = this.getFilteredTools();
    const { toolName, args } = await this.selectTool(tools);
    const target: McpToolCall = { name: toolName, input: args };

    if (this.context.stepDefinition.automaticExecution) {
      // Branch B -- direct execution
      return this.executeToolAndPersist(target);
    }

    // Branch C -- Awaiting confirmation
    try {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        type: 'mcp-task',
        stepIndex: this.context.stepIndex,
        pendingData: target,
      });
    } catch (cause) {
      throw new StepPersistenceError(
        `MCP task step state could not be persisted ` +
          `(run "${this.context.runId}", step ${this.context.stepIndex})`,
        cause,
      );
    }

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  private async executeToolAndPersist(
    target: McpToolCall,
    existingExecution?: McpTaskStepExecutionData,
  ): Promise<StepExecutionResult> {
    const tools = this.getFilteredTools();
    const tool = tools.find(t => t.base.name === target.name);
    if (!tool) throw new McpToolNotFoundError(target.name);

    let toolResult: unknown;

    try {
      toolResult = await tool.base.invoke(target.input);
    } catch (cause) {
      throw new McpToolInvocationError(target.name, cause);
    }

    // 1. Persist raw result immediately — safe state before any further network calls
    const baseExecutionResult = { success: true as const, toolResult };
    const baseData: McpTaskStepExecutionData = {
      ...existingExecution,
      type: 'mcp-task',
      stepIndex: this.context.stepIndex,
      executionParams: { name: target.name, input: target.input },
      executionResult: baseExecutionResult,
    };

    try {
      await this.context.runStore.saveStepExecution(this.context.runId, baseData);
    } catch (cause) {
      throw new StepPersistenceError(
        `MCP tool "${target.name}" executed but step state could not be persisted ` +
          `(run "${this.context.runId}", step ${this.context.stepIndex})`,
        cause,
      );
    }

    // 2. AI formatting — non-blocking; errors are logged but do not fail the step
    try {
      const formattedResponse = await this.formatToolResult(target, toolResult);

      if (formattedResponse) {
        await this.context.runStore.saveStepExecution(this.context.runId, {
          ...baseData,
          executionResult: { ...baseExecutionResult, formattedResponse },
        });
      }
    } catch (cause) {
      this.context.logger.error('Failed to format MCP tool result, using generic fallback', {
        runId: this.context.runId,
        stepIndex: this.context.stepIndex,
        toolName: target.name,
        cause: cause instanceof Error ? cause.message : String(cause),
      });
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
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(MCP_TASK_SYSTEM_PROMPT),
      new HumanMessage(
        `**Request**: ${this.context.stepDefinition.prompt ?? 'Execute the relevant tool.'}`,
      ),
    ];

    return this.invokeWithTools(
      messages,
      tools.map(t => t.base),
    );
  }

  /** Returns tools filtered by mcpServerId (if specified). Throws NoMcpToolsError if empty. */
  private getFilteredTools(): RemoteTool[] {
    const { mcpServerId } = this.context.stepDefinition;
    const tools = mcpServerId
      ? this.remoteTools.filter(t => t.sourceId === mcpServerId)
      : [...this.remoteTools];
    if (tools.length === 0) throw new NoMcpToolsError();

    return tools;
  }
}
