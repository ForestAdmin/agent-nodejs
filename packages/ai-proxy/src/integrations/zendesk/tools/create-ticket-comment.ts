import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createCreateTicketCommentTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'zendesk_create_ticket_comment',
    description: 'Add a new comment to an existing Zendesk ticket',
    schema: z.object({
      ticket_id: z.number().int().positive().describe('The ID of the ticket to add a comment to'),
      comment: z.string().min(1).describe('The comment text to add'),
      public: z
        .boolean()
        .optional()
        .default(true)
        .describe('Whether the comment is visible to the requester (true) or internal only (false)'),
    }),
    func: async ({ ticket_id, comment, public: isPublic }) => {
      const updateData = {
        ticket: {
          comment: {
            body: comment,
            public: isPublic,
          },
        },
      };

      const response = await fetch(`${baseUrl}/tickets/${ticket_id}.json`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData),
      });

      return JSON.stringify(await response.json());
    },
  });
}
