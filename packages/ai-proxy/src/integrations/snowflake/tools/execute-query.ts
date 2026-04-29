import type { SnowflakeConfig } from '../tools';

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { assertReadOnlySql, assertResponseOk, buildSessionContext } from '../utils';

export default function createExecuteQueryTool(
  headers: Record<string, string>,
  baseUrl: string,
  config: SnowflakeConfig,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'snowflake_execute_query',
    description:
      'Execute a read-only SQL query on Snowflake and return the results. ' +
      'Only SELECT, WITH, SHOW, DESCRIBE, and EXPLAIN statements are allowed. ' +
      'Multiple statements are not permitted.',
    schema: z.object({
      statement: z.string().min(1).describe('The read-only SQL statement to execute'),
      warehouse: z
        .string()
        .optional()
        .describe('Warehouse to use for this query (overrides the default)'),
      database: z
        .string()
        .optional()
        .describe('Database to use for this query (overrides the default)'),
      schema: z
        .string()
        .optional()
        .describe('Schema to use for this query (overrides the default)'),
      role: z.string().optional().describe('Role to use for this query (overrides the default)'),
    }),
    func: async ({ statement, warehouse, database, schema, role }) => {
      assertReadOnlySql(statement);

      const body = {
        statement,
        ...buildSessionContext(config),
        ...(warehouse && { warehouse }),
        ...(database && { database }),
        ...(schema && { schema }),
        ...(role && { role }),
      };

      const response = await fetch(`${baseUrl}/api/v2/statements`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      await assertResponseOk(response, 'execute query');

      return JSON.stringify(await response.json());
    },
  });
}
