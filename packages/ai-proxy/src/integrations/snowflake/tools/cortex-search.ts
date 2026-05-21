import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { assertResponseOk } from '../utils';

export default function createCortexSearchTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'snowflake_cortex_search',
    description:
      'Search data using a Snowflake Cortex Search service. ' +
      'Returns semantic search results ranked by relevance. ' +
      'The caller must provide the fully qualified service identifier (database, schema, service).',
    schema: z.object({
      database: z.string().min(1).describe('Name of the database containing the search service'),
      schema: z.string().min(1).describe('Name of the schema containing the search service'),
      service: z.string().min(1).describe('Name of the Cortex Search service'),
      query: z.string().min(1).describe('The natural-language search query'),
      columns: z
        .array(z.string().min(1))
        .optional()
        .describe('Columns to include in the search results'),
      filter: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Optional filter expression as a JSON object'),
      limit: z
        .number()
        .int()
        .positive()
        .max(1000)
        .optional()
        .describe('Maximum number of results to return (default: service-defined)'),
    }),
    func: async ({ database, schema, service, query, columns, filter, limit }) => {
      const url =
        `${baseUrl}/api/v2/databases/${encodeURIComponent(database)}` +
        `/schemas/${encodeURIComponent(schema)}` +
        `/cortex-search-services/${encodeURIComponent(service)}:query`;

      const body: Record<string, unknown> = { query };
      if (columns) body.columns = columns;
      if (filter) body.filter = filter;
      if (limit !== undefined) body.limit = limit;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      await assertResponseOk(response, 'cortex search');

      return JSON.stringify(await response.json());
    },
  });
}
