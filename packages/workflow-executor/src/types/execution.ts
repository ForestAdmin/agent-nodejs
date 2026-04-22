/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { ActivityLogPort } from '../ports/activity-log-port';
import type { AgentPort } from '../ports/agent-port';
import type { Logger } from '../ports/logger-port';
import type { RunStore } from '../ports/run-store';
import type { WorkflowPort } from '../ports/workflow-port';
import type SchemaCache from '../schema-cache';
import type { BaseChatModel } from '@forestadmin/ai-proxy';

import { z } from 'zod';

import { type RecordRef, RecordRefSchema } from './record';
import { type StepDefinition, StepDefinitionSchema } from './step-definition';
import { type StepOutcome, StepOutcomeSchema } from './step-outcome';

export const StepUserSchema = z.object({
  id: z.number(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  team: z.string(),
  renderingId: z.number().finite(),
  role: z.string(),
  permissionLevel: z.string(),
  tags: z.record(z.string(), z.string()),
});
export type StepUser = z.infer<typeof StepUserSchema>;

export const StepSchema = z.object({
  stepDefinition: StepDefinitionSchema,
  stepOutcome: StepOutcomeSchema,
});
export type Step = z.infer<typeof StepSchema>;

export const PendingStepExecutionSchema = z.object({
  runId: z.string().min(1),
  stepId: z.string().min(1),
  stepIndex: z.number().int().nonnegative(),
  collectionId: z.string().min(1),
  baseRecordRef: RecordRefSchema,
  stepDefinition: StepDefinitionSchema,
  previousSteps: z.array(StepSchema),
  user: StepUserSchema,
});
export type PendingStepExecution = z.infer<typeof PendingStepExecutionSchema>;

export interface StepExecutionResult {
  stepOutcome: StepOutcome;
}

export interface IStepExecutor {
  execute(): Promise<StepExecutionResult>;
}

// ExecutionContext holds port instances (with methods) — not zod-validatable.
export interface ExecutionContext<TStep extends StepDefinition = StepDefinition> {
  readonly runId: string;
  readonly stepId: string;
  readonly stepIndex: number;
  readonly collectionId: string;
  readonly baseRecordRef: RecordRef;
  readonly stepDefinition: TStep;
  readonly model: BaseChatModel;
  readonly agentPort: AgentPort;
  readonly workflowPort: WorkflowPort;
  readonly runStore: RunStore;
  readonly user: StepUser;
  readonly schemaCache: SchemaCache;
  readonly previousSteps: ReadonlyArray<Readonly<Step>>;
  readonly logger: Logger;
  readonly incomingPendingData?: unknown;
  readonly stepTimeoutMs?: number;
  readonly activityLogPort: ActivityLogPort;
}
