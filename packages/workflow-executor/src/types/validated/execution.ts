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

export const AvailableStepExecutionSchema = z
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
export type AvailableStepExecution = z.infer<typeof AvailableStepExecutionSchema>;
