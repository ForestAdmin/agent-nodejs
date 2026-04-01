import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { assertResponseOk } from '../utils';

export default function createGetScreeningResultTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'kolar_get_screening_result',
    description:
      'Retrieve the full result of a submitted screening by alert ID, including risk score and match details.',
    schema: z.object({
      id: z.number().int().positive().describe('The alert ID returned by kolar_screen_transaction'),
    }),
    func: async ({ id }) => {
      const response = await fetch(`${baseUrl}/alert/${id}/result`, { headers });

      await assertResponseOk(response, 'get screening result');

      return JSON.stringify(await response.json());
    },
  });
}
