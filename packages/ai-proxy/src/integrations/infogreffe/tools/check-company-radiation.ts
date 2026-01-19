import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { searchV1Api } from '../utils';

const AVAILABLE_YEARS = [2025, 2024, 2023, 2022] as const;

export default function createCheckCompanyRadiationTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'infogreffe_check_company_radiation',
    description:
      'Check if a French company (by SIREN or name) is struck off from RCS. If no year is specified, checks all available years (2022-2025)',
    schema: z
      .object({
        siren: z.string().length(9).optional().describe('SIREN number (9 digits)'),
        denomination: z.string().optional().describe('Company name'),
        year: z
          .enum(['2022', '2023', '2024', '2025'])
          .optional()
          .describe('Specific year to check (optional, checks all years if not provided)'),
      })
      .refine(data => data.siren || data.denomination, {
        message: 'Either siren or denomination is required',
      }),
    func: async ({ siren, denomination, year }) => {
      const query = siren ? `siren:${siren}` : `denomination:${denomination}`;
      const yearsToCheck = year ? [parseInt(year, 10)] : [...AVAILABLE_YEARS];

      const results = await Promise.all(
        yearsToCheck.map(async checkYear => {
          const dataset = `entreprises-radiees-en-${checkYear}`;
          const result = await searchV1Api(headers, dataset, query, 10);

          return { checkYear, result };
        }),
      );

      const allResults: Array<Record<string, unknown>> = [];

      for (const { checkYear, result } of results) {
        if (result.nhits > 0) {
          for (const r of result.records) {
            const fields = r.fields as Record<string, unknown>;
            allResults.push({
              annee: checkYear,
              siren: fields.siren,
              denomination: fields.denomination,
              date_radiation: fields.date_radiation,
              date_immatriculation: fields.date_immatriculation,
              forme_juridique: fields.forme_juridique,
              ville: fields.ville,
              code_postal: fields.code_postal,
              adresse: fields.adresse,
              secteur_d_activite: fields.secteur_d_activite,
              greffe: fields.greffe,
            });
          }
        }
      }

      if (allResults.length === 0) {
        return JSON.stringify({
          est_radiee: false,
          annees_verifiees: yearsToCheck,
          critere: { siren, denomination },
          message: 'No radiation found for this company',
        });
      }

      return JSON.stringify({
        est_radiee: true,
        annees_verifiees: yearsToCheck,
        nb_resultats: allResults.length,
        entreprises: allResults,
      });
    },
  });
}
