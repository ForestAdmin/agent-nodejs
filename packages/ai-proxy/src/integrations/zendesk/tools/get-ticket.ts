import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { assertResponseOk } from '../utils';

export default function createGetTicketTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'zendesk_get_ticket',
    description: 'Retrieve a single Zendesk ticket by its ID',
    schema: z.object({
      ticket_id: z.number().int().positive().describe('The ID of the ticket to retrieve'),
    }),
    func: async ({ ticket_id }) => {
      const response = await fetch(`${baseUrl}/tickets/${ticket_id}.json`, {
        headers,
      });

      await assertResponseOk(response, 'get ticket');

      return JSON.stringify(await response.json());
    },
  });
}
