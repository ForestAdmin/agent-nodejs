import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { assertResponseOk } from '../utils';

export default function createGetEntityProfileTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'kolar_get_entity_profile',
    description:
      "Retrieve a monitored entity's risk profile and screening history by alert result ID.",
    schema: z.object({
      alertResultId: z.number().int().positive().describe('The alert result ID'),
    }),
    func: async ({ alertResultId }) => {
      const response = await fetch(`${baseUrl}/internal-control/${alertResultId}/history`, {
        headers,
      });

      await assertResponseOk(response, 'get entity profile');

      return JSON.stringify(await response.json());
    },
  });
}
