import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { searchV1Api } from '../utils';

export default function createGetCompanyDetailsTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'infogreffe_get_company_details',
    description: 'Get full details of a French company (struck-off or registered) by SIREN or name',
    schema: z
      .object({
        siren: z.string().length(9).optional().describe('SIREN number (9 digits)'),
        denomination: z.string().optional().describe('Company name'),
        year: z
          .enum(['2022', '2023', '2024', '2025'])
          .default('2024')
          .describe('Year to search (default: 2024)'),
      })
      .refine(data => data.siren || data.denomination, {
        message: 'Either siren or denomination is required',
      }),
    func: async ({ siren, denomination, year }) => {
      const query = siren ? `siren:${siren}` : `denomination:${denomination}`;

      const [resultRad, resultImmat] = await Promise.all([
        searchV1Api(headers, `entreprises-radiees-en-${year}`, query, 5),
        searchV1Api(headers, `entreprises-immatriculees-en-${year}`, query, 5),
      ]);

      return JSON.stringify({
        critere: { siren, denomination },
        annee_recherchee: year,
        radiations: {
          total: resultRad.nhits,
          entreprises: resultRad.records.map(r => r.fields),
        },
        immatriculations: {
          total: resultImmat.nhits,
          entreprises: resultImmat.records.map(r => r.fields),
        },
      });
    },
  });
}
