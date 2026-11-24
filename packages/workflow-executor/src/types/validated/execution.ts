import { IANAZone } from 'luxon';
import { z } from 'zod';

import { RecordRefSchema } from './collection';
import { StepDefinitionSchema } from './step-definition';
import { StepOutcomeSchema } from './step-outcome';

export const StepUserSchema = z
  .object({
    id: z.number(),
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    team: z.string(),
    renderingId: z.number().int().nonnegative(),
    role: z.string(),
    permissionLevel: z.string(),
    tags: z.record(z.string(), z.string()),
  })
  .strict();
export type StepUser = z.infer<typeof StepUserSchema>;

export const StepSchema = z
  .object({
    stepDefinition: StepDefinitionSchema,
    stepOutcome: StepOutcomeSchema,
    // Set on a revision clone (a still-valid step the orchestrator re-injects); points at the
    // step it copies. The executor never ran the clone, so its record lives at that index.
    // Absent for steps the executor ran itself.
    originalStepIndex: z.number().int().nonnegative().optional(),
  })
  .strict();
export type Step = z.infer<typeof StepSchema>;

export enum TriggerType {
  Manual = 'manual',
  Webhook = 'webhook',
  Mcp = 'mcp',
  DataChange = 'dataChange',
}
export const TriggerTypeSchema = z.nativeEnum(TriggerType);

// Grouped because every field describes the same call. The frame is a set of steps rather than an
// upper bound, because a nested call's body sits between a frame's steps.
export const CallScopeSchema = z
  .object({
    selectedRecordStepId: z.string().min(1).optional(),
    pinnedFrameStepIndexes: z.array(z.number().int().nonnegative()).optional(),
    // The steps of the frame the pending step runs in, where a pin to a real step id is looked for.
    currentFrameStepIndexes: z.array(z.number().int().nonnegative()).optional(),
    calledWorkflowCollectionName: z.string().min(1).optional(),
    // The call itself carries a pin, "workflow start" included. A pin resolving outwards to the run's
    // record sends no selectedRecordStepId, and this is what still tells it from an unpinned call.
    isPinned: z.literal(true).optional(),
    // Every enclosing call opened once per record, outermost first: its Multiple step, read in the
    // frame that pinned it, its record's position, and where its start entry sits.
    recordCalls: z
      .array(
        z
          .object({
            selectedRecordStepId: z.string().min(1),
            pinnedFrameStepIndexes: z.array(z.number().int().nonnegative()),
            recordIndex: z.number().int().nonnegative(),
            startStepIndex: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .min(1)
      .optional(),
  })
  .strict();
export type CallScope = z.infer<typeof CallScopeSchema>;

// A Sub-workflow step run once per record reached one End per record: none of them is its End.
export const SubWorkflowEndSchema = z.union([
  z.object({ stepId: z.string().min(1), endStepId: z.string().min(1) }).strict(),
  z.object({ stepId: z.string().min(1), perRecord: z.literal(true) }).strict(),
]);
export type SubWorkflowEnd = z.infer<typeof SubWorkflowEndSchema>;

export const AvailableStepExecutionSchema = z
  .object({
    runId: z.string().min(1),
    stepId: z.string().min(1),
    stepIndex: z.number().int().nonnegative(),
    collectionId: z.string().min(1),
    triggerType: TriggerTypeSchema,
    baseRecordRef: RecordRefSchema,
    stepDefinition: StepDefinitionSchema,
    previousSteps: z.array(StepSchema),
    user: StepUserSchema,
    // Refused rather than trusted: Luxon reads an unknown zone as invalid and every relative
    // condition would then quietly not match. The mapper normalises to UTC, so this only ever
    // fires on a mapper bug.
    timezone: z.string().refine(IANAZone.isValidZone),
    callScope: CallScopeSchema.optional(),
    subWorkflowEnds: z.array(SubWorkflowEndSchema).optional(),
    // The step still carries the error of its last report: a success or a pause clears it.
    carriesError: z.literal(true).optional(),
    // Absent from an orchestrator that predates it; the run's activity logs then carry no workflow.
    workflowName: z.string().min(1).optional(),
  })
  .strict();
export type AvailableStepExecution = z.infer<typeof AvailableStepExecutionSchema>;
