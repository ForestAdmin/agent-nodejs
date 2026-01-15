import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createUpdateTicketTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'zendesk_update_ticket',
    description: 'Update fields on an existing Zendesk ticket',
    schema: z.object({
      ticket_id: z.number().int().positive().describe('The ID of the ticket to update'),
      subject: z.string().min(1).optional().describe('New subject for the ticket'),
      status: z
        .enum(['new', 'open', 'pending', 'hold', 'solved', 'closed'])
        .optional()
        .describe('New status for the ticket'),
      priority: z
        .enum(['low', 'normal', 'high', 'urgent'])
        .optional()
        .describe('New priority for the ticket'),
      type: z
        .enum(['problem', 'incident', 'question', 'task'])
        .optional()
        .describe('New type for the ticket'),
      assignee_id: z.number().int().positive().optional().describe('New assignee ID for the ticket'),
      requester_id: z.number().int().positive().optional().describe('New requester ID for the ticket'),
      tags: z.array(z.string()).optional().describe('New tags for the ticket (replaces existing tags)'),
      custom_fields: z
        .array(
          z.object({
            id: z.number().describe('The custom field ID'),
            value: z.unknown().describe('The custom field value'),
          }),
        )
        .optional()
        .describe('Custom fields to update'),
      due_at: z.string().optional().describe('Due date in ISO8601 format (for task tickets)'),
    }),
    func: async ({
      ticket_id,
      subject,
      status,
      priority,
      type,
      assignee_id,
      requester_id,
      tags,
      custom_fields,
      due_at,
    }) => {
      const ticketUpdate: Record<string, unknown> = {};

      if (subject !== undefined) ticketUpdate.subject = subject;
      if (status !== undefined) ticketUpdate.status = status;
      if (priority !== undefined) ticketUpdate.priority = priority;
      if (type !== undefined) ticketUpdate.type = type;
      if (assignee_id !== undefined) ticketUpdate.assignee_id = assignee_id;
      if (requester_id !== undefined) ticketUpdate.requester_id = requester_id;
      if (tags !== undefined) ticketUpdate.tags = tags;
      if (custom_fields !== undefined) ticketUpdate.custom_fields = custom_fields;
      if (due_at !== undefined) ticketUpdate.due_at = due_at;

      const response = await fetch(`${baseUrl}/tickets/${ticket_id}.json`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ ticket: ticketUpdate }),
      });

      return JSON.stringify(await response.json());
    },
  });
}
