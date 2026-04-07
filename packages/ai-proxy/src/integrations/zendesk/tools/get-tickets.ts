import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { assertResponseOk } from '../utils';

const searchFiltersSchema = z.object({
  requester_email: z.string().email().optional().describe('Filter tickets by requester email'),
  assignee_email: z.string().email().optional().describe('Filter tickets by assignee email'),
  submitter_email: z.string().email().optional().describe('Filter tickets by submitter email'),
  cc_email: z.string().email().optional().describe('Filter tickets where this email is in CC'),
  status: z
    .enum(['new', 'open', 'pending', 'hold', 'solved', 'closed'])
    .optional()
    .describe('Filter by ticket status'),
  priority: z
    .enum(['urgent', 'high', 'normal', 'low'])
    .optional()
    .describe('Filter by ticket priority'),
  ticket_type: z
    .enum(['ticket', 'question', 'incident', 'problem', 'task'])
    .optional()
    .describe('Filter by ticket type'),
  group: z.string().optional().describe('Filter by group name'),
  brand: z.string().optional().describe('Filter by brand name'),
  tags: z.array(z.string()).optional().describe('Filter by tags'),
  subject: z.string().optional().describe('Search in ticket subject'),
  description: z.string().optional().describe('Search in ticket description'),
  created_after: z.string().optional().describe('Tickets created after this date (YYYY-MM-DD)'),
  created_before: z.string().optional().describe('Tickets created before this date (YYYY-MM-DD)'),
  updated_after: z.string().optional().describe('Tickets updated after this date (YYYY-MM-DD)'),
  solved_after: z.string().optional().describe('Tickets solved after this date (YYYY-MM-DD)'),
  keyword: z.string().optional().describe('Free text search across ticket fields'),
});
const baseSchema = z.object({
  page: z.number().int().positive().optional().describe('Page number for pagination (default: 1)'),
  per_page: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe('Number of tickets per page, max 100 (default: 25)'),
  sort_by: z
    .enum(['created_at', 'updated_at', 'priority', 'status'])
    .optional()
    .describe('Field to sort tickets by (default: created_at)'),
  sort_order: z.enum(['asc', 'desc']).optional().describe('Sort order (default: desc)'),
});
const schema = searchFiltersSchema.extend(baseSchema.shape);

type SearchFilters = z.infer<typeof searchFiltersSchema>;
type Input = z.infer<typeof schema>;

const FILTER_TO_QUERY: Record<string, (value: unknown) => string> = {
  requester_email: v => `requester:${v}`,
  assignee_email: v => `assignee:${v}`,
  submitter_email: v => `submitter:${v}`,
  cc_email: v => `cc:${v}`,
  status: v => `status:${v}`,
  priority: v => `priority:${v}`,
  ticket_type: v => `type:${v}`,
  group: v => `group:${v}`,
  brand: v => `brand:${v}`,
  tags: v => (v as string[]).map(t => `tags:${t}`).join(' '),
  subject: v => `subject:${v}`,
  description: v => `description:${v}`,
  created_after: v => `created>${v}`,
  created_before: v => `created<${v}`,
  updated_after: v => `updated>${v}`,
  solved_after: v => `solved>${v}`,
  keyword: v => `${v}`,
};

function buildSearchQuery(filters: SearchFilters): string | null {
  const parts: string[] = [];

  for (const [key, toQuery] of Object.entries(FILTER_TO_QUERY)) {
    const value = filters[key as keyof SearchFilters];

    if (value !== undefined && value !== null) {
      parts.push(toQuery(value));
    }
  }

  if (parts.length === 0) return null;

  if (!filters.ticket_type) parts.push('type:ticket');

  return parts.join(' ');
}

export default function createGetTicketsTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'zendesk_get_tickets',
    description:
      'Fetch Zendesk tickets. Without filters, returns a paginated list. With filters, searches using the Zendesk Search API.',
    schema,
    func: async (input: Input) => {
      const {
        page: rawPage,
        per_page: rawPerPage,
        sort_by: rawSortBy,
        sort_order: rawSortOrder,
        ...filters
      } = input;
      const page = rawPage ?? 1;
      const perPage = rawPerPage ?? 25;
      const sortBy = rawSortBy ?? 'created_at';
      const sortOrder = rawSortOrder ?? 'desc';
      const query = buildSearchQuery(filters);

      if (query) {
        const params = new URLSearchParams({
          query,
          page: page.toString(),
          per_page: perPage.toString(),
          sort_by: sortBy,
          sort_order: sortOrder,
        });

        const response = await fetch(`${baseUrl}/search.json?${params}`, { headers });
        await assertResponseOk(response, 'search tickets');

        return JSON.stringify(await response.json());
      }

      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      const response = await fetch(`${baseUrl}/tickets.json?${params}`, { headers });
      await assertResponseOk(response, 'get tickets');

      return JSON.stringify(await response.json());
    },
  });
}
