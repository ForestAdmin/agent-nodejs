import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { AIBadRequestError } from '../../../errors';
import { assertResponseOk } from '../utils';

export default function createCortexAnalystTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'snowflake_cortex_analyst',
    description:
      'Ask a natural-language analytical question against a Snowflake semantic model or ' +
      'semantic view using Cortex Analyst. Returns a generated SQL query and the answer. ' +
      'Exactly one of `semantic_model_file` or `semantic_view` must be provided.',
    schema: z.object({
      question: z.string().min(1).describe('The natural-language analytical question'),
      semantic_model_file: z
        .string()
        .optional()
        .describe(
          'Stage path to the YAML semantic model file ' +
            '(e.g. "@my_db.my_schema.my_stage/model.yaml")',
        ),
      semantic_view: z
        .string()
        .optional()
        .describe('Fully qualified semantic view name (e.g. "my_db.my_schema.my_view")'),
    }),
    func: async ({ question, semantic_model_file, semantic_view }) => {
      if (!semantic_model_file && !semantic_view) {
        throw new AIBadRequestError(
          'Either `semantic_model_file` or `semantic_view` must be provided.',
        );
      }

      if (semantic_model_file && semantic_view) {
        throw new AIBadRequestError(
          'Provide only one of `semantic_model_file` or `semantic_view`, not both.',
        );
      }

      const body: Record<string, unknown> = {
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: question }],
          },
        ],
        ...(semantic_model_file && { semantic_model_file }),
        ...(semantic_view && { semantic_view }),
      };

      const response = await fetch(`${baseUrl}/api/v2/cortex/analyst/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      await assertResponseOk(response, 'cortex analyst');

      return JSON.stringify(await response.json());
    },
  });
}
