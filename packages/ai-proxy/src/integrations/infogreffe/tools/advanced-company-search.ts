import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { buildQuery, searchV1Api } from '../utils';

export default function createAdvancedCompanySearchTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'infogreffe_advanced_company_search',
    description:
      'Advanced multi-criteria search for French companies with combined filters (year, city, sector, legal form, etc.)',
    schema: z.object({
      ville: z.string().optional().describe('City (e.g., PARIS)'),
      code_postal: z.string().optional().describe('Postal code (e.g., 75001)'),
      secteur_d_activite: z.string().optional().describe('Business sector'),
      code_ape: z.string().optional().describe('APE/NAF code (e.g., 6420Z)'),
      forme_juridique: z.string().optional().describe('Legal form'),
      status: z
        .enum(['active', 'closed'])
        .default('active')
        .describe('Status: active (registered) or closed (struck-off)'),
      year: z.enum(['2022', '2023', '2024', '2025']).default('2024').describe('Year'),
      limit: z.number().int().positive().default(20).describe('Maximum results (default: 20)'),
    }),
    func: async ({
      ville,
      code_postal,
      secteur_d_activite,
      code_ape,
      forme_juridique,
      status,
      year,
      limit,
    }) => {
      const dataset =
        status === 'closed'
          ? `entreprises-radiees-en-${year}`
          : `entreprises-immatriculees-en-${year}`;

      const query = buildQuery([
        ville && `ville:${ville}`,
        code_postal && `code_postal:${code_postal}`,
        secteur_d_activite && `secteur_d_activite:"${secteur_d_activite}"`,
        code_ape && `code_ape:${code_ape}`,
        forme_juridique && `forme_juridique:"${forme_juridique}"`,
      ]);

      const result = await searchV1Api(headers, dataset, query, limit);

      return JSON.stringify({
        criteres: {
          ville,
          code_postal,
          secteur_d_activite,
          code_ape,
          forme_juridique,
          status,
          year,
        },
        total_resultats: result.nhits,
        resultats_affiches: result.records.length,
        entreprises: result.records.map(r => {
          const fields = r.fields as Record<string, unknown>;

          return {
            siren: fields.siren,
            denomination: fields.denomination,
            adresse: fields.adresse,
            code_postal: fields.code_postal,
            ville: fields.ville,
            forme_juridique: fields.forme_juridique,
            secteur_d_activite: fields.secteur_d_activite,
            code_ape: fields.code_ape,
            date_immatriculation: fields.date_immatriculation,
            date_radiation: fields.date_radiation,
          };
        }),
      });
    },
  });
}
