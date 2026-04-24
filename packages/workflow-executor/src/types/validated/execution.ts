/** @draft Types derived from the workflow-executor spec -- subject to change. */

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
  })
  .strict();
export type Step = z.infer<typeof StepSchema>;

export const PendingStepExecutionSchema = z
  .object({
    runId: z.string().min(1),
    stepId: z.string().min(1),
    stepIndex: z.number().int().nonnegative(),
    collectionId: z.string().min(1),
    baseRecordRef: RecordRefSchema,
    stepDefinition: StepDefinitionSchema,
    previousSteps: z.array(StepSchema),
    user: StepUserSchema,
  })
  .strict();
export type PendingStepExecution = z.infer<typeof PendingStepExecutionSchema>;
