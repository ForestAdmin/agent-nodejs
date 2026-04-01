import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { assertResponseOk } from '../utils';

export default function createUpdateDecisionTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'kolar_update_decision',
    description:
      "Record a compliance officer's decision (compliant/non-compliant) on a screened transaction's internal control.",
    schema: z.object({
      id: z.number().int().positive().describe('The internal control ID'),
      decision: z.enum(['COMPLIANT', 'NON_COMPLIANT']).describe('The review decision'),
      rationale: z.string().min(1).describe('Rationale for the review decision'),
      reviewedBy: z.string().min(1).describe('Username of the reviewer'),
    }),
    func: async ({ id, decision, rationale, reviewedBy }) => {
      const response = await fetch(`${baseUrl}/internal-control/${id}/review`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ decision, rationale, reviewedBy }),
      });

      await assertResponseOk(response, 'update decision');

      return JSON.stringify(await response.json());
    },
  });
}
