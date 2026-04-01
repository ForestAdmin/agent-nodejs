import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { assertResponseOk } from '../utils';

export default function createListPendingReviewsTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'kolar_list_pending_reviews',
    description: 'List transactions awaiting a manual compliance review.',
    schema: z.object({}),
    func: async () => {
      const response = await fetch(`${baseUrl}/internal-control?status=PENDING`, { headers });

      await assertResponseOk(response, 'list pending reviews');

      return JSON.stringify(await response.json());
    },
  });
}
