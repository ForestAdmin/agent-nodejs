import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createGetTicketCommentsTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'zendesk_get_ticket_comments',
    description: 'Get all comments for a specific Zendesk ticket',
    schema: z.object({
      ticket_id: z.number().int().positive().describe('The ID of the ticket to get comments for'),
    }),
    func: async ({ ticket_id }) => {
      const response = await fetch(`${baseUrl}/tickets/${ticket_id}/comments.json`, {
        headers,
      });

      return JSON.stringify(await response.json());
    },
  });
}
