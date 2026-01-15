import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createCreateTicketTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'zendesk_create_ticket',
    description: 'Create a new Zendesk ticket',
    schema: z.object({
      subject: z.string().min(1).describe('The subject/title of the ticket'),
      description: z.string().min(1).describe('The description/body of the ticket'),
      requester_id: z.number().int().positive().optional().describe('The ID of the requester'),
      assignee_id: z.number().int().positive().optional().describe('The ID of the assignee'),
      priority: z
        .enum(['low', 'normal', 'high', 'urgent'])
        .optional()
        .describe('The priority level of the ticket'),
      type: z
        .enum(['problem', 'incident', 'question', 'task'])
        .optional()
        .describe('The type of the ticket'),
      tags: z.array(z.string()).optional().describe('Tags to apply to the ticket'),
      custom_fields: z
        .array(
          z.object({
            id: z.number().describe('The custom field ID'),
            value: z.unknown().describe('The custom field value'),
          }),
        )
        .optional()
        .describe('Custom fields to set on the ticket'),
    }),
    func: async ({ subject, description, requester_id, assignee_id, priority, type, tags, custom_fields }) => {
      const ticketData: Record<string, unknown> = {
        ticket: {
          subject,
          comment: { body: description },
          ...(requester_id && { requester_id }),
          ...(assignee_id && { assignee_id }),
          ...(priority && { priority }),
          ...(type && { type }),
          ...(tags && { tags }),
          ...(custom_fields && { custom_fields }),
        },
      };

      const response = await fetch(`${baseUrl}/tickets.json`, {
        method: 'POST',
        headers,
        body: JSON.stringify(ticketData),
      });

      return JSON.stringify(await response.json());
    },
  });
}
