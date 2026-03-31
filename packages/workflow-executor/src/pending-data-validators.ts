import type { StepExecutionData } from './types/step-execution-data';

import { z } from 'zod';

// Per-step-type body schemas for PATCH /runs/:runId/steps/:stepIndex/pending-data.
// Only step types that support the confirmation flow are listed here — others return 404.
// Schemas use .strict() to reject unknown fields from the client.
const patchBodySchemas: Partial<Record<StepExecutionData['type'], z.ZodTypeAny>> = {
  'update-record': z
    .object({
      userConfirmed: z.boolean(),
      value: z.string().optional(), // user may override the AI-proposed value
    })
    .strict(),

  'trigger-action': z.object({ userConfirmed: z.boolean() }).strict(),

  mcp: z.object({ userConfirmed: z.boolean() }).strict(),

  'load-related-record': z
    .object({
      userConfirmed: z.boolean(),
      // User may intentionally switch to a different relation than the one the AI selected.
      // The executor re-derives relatedCollectionName from FieldSchema when processing the confirmation.
      name: z.string().optional(),
      displayName: z.string().optional(),
      // User may override the AI-selected record; must be non-empty when provided.
      selectedRecordId: z
        .array(z.union([z.string(), z.number()]))
        .min(1)
        .optional(),
    })
    .strict(),
  // relatedCollectionName and suggestedFields are NOT accepted — internal executor data.
};

export default patchBodySchemas;
