import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { assertResponseOk } from '../utils';

export default function createGetMerchantApplicationResultTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'kolar_get_merchant_application_result',
    description:
      'Retrieve the KYB analysis result of a merchant application by ID. Returns jobStatus (PENDING, RUNNING, COMPLETED, FAILED) and result with decision (APPROVED, REJECTED, REVIEW), riskScore, and rationale when completed.',
    schema: z.object({
      id: z
        .number()
        .int()
        .positive()
        .describe('The merchant application ID returned by kolar_create_merchant_application'),
    }),
    func: async ({ id }) => {
      const response = await fetch(`${baseUrl}/merchant-application/${id}/result`, { headers });

      await assertResponseOk(response, 'get merchant application result');

      return JSON.stringify(await response.json());
    },
  });
}
