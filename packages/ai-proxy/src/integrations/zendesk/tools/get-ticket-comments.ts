import type { ZendeskRequest } from '../utils';

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { assertResponseOk } from '../utils';

export default function createGetTicketCommentsTool(
  request: ZendeskRequest,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'zendesk_get_ticket_comments',
    description: 'Get all comments for a specific Zendesk ticket',
    schema: z.object({
      ticket_id: z.number().int().positive().describe('The ID of the ticket to get comments for'),
    }),
    func: async ({ ticket_id }) => {
      const response = await request(`${baseUrl}/tickets/${ticket_id}/comments.json`);

      await assertResponseOk(response, 'get ticket comments');

      return JSON.stringify(await response.json());
    },
  });
}
