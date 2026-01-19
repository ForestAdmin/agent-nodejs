import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createGetTicketsTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'zendesk_get_tickets',
    description: 'Fetch a paginated list of Zendesk tickets with sorting options',
    schema: z.object({
      page: z.number().int().positive().optional().default(1).describe('Page number for pagination'),
      per_page: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .default(25)
        .describe('Number of tickets per page (max 100)'),
      sort_by: z
        .enum(['created_at', 'updated_at', 'priority', 'status'])
        .optional()
        .default('created_at')
        .describe('Field to sort tickets by'),
      sort_order: z.enum(['asc', 'desc']).optional().default('desc').describe('Sort order'),
    }),
    func: async ({ page, per_page, sort_by, sort_order }) => {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: per_page.toString(),
        sort_by,
        sort_order,
      });

      const response = await fetch(`${baseUrl}/tickets.json?${params}`, {
        headers,
      });

      return JSON.stringify(await response.json());
    },
  });
}
