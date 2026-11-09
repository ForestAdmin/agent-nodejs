import type { ZendeskRequest } from '../utils';

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { assertResponseOk } from '../utils';

export default function createCreateTicketCommentTool(
  request: ZendeskRequest,
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
        .describe(
          'Whether the comment is visible to the requester (true) or internal only (false)',
        ),
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

      const response = await request(`${baseUrl}/tickets/${ticket_id}.json`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      await assertResponseOk(response, 'create ticket comment');

      return JSON.stringify(await response.json());
    },
  });
}
