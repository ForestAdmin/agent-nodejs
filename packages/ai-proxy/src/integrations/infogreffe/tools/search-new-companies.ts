import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { buildQuery, searchV1Api } from '../utils';

export default function createSearchNewCompaniesTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'infogreffe_search_new_companies',
    description: 'Search for newly registered French companies by various criteria',
    schema: z.object({
      year: z.enum(['2022', '2023', '2024', '2025']).default('2024').describe('Registration year'),
      siren: z.string().length(9).optional().describe('SIREN number'),
      denomination: z.string().optional().describe('Company name'),
      ville: z.string().optional().describe('City'),
      region: z.string().optional().describe('Region'),
      secteur_d_activite: z.string().optional().describe('Business sector'),
      limit: z.number().int().positive().default(10).describe('Maximum results (default: 10)'),
    }),
    func: async ({ year, siren, denomination, ville, region, secteur_d_activite, limit }) => {
      const dataset = `entreprises-immatriculees-en-${year}`;

      const query = buildQuery([
        siren && `siren:${siren}`,
        denomination && `denomination:${denomination}`,
        ville && `ville:${ville}`,
        region && `region:${region}`,
        secteur_d_activite && `secteur_d_activite:${secteur_d_activite}`,
      ]);

      const result = await searchV1Api(headers, dataset, query, limit);

      return JSON.stringify({
        annee: year,
        total_resultats: result.nhits,
        resultats_affiches: result.records.length,
        entreprises: result.records.map(r => {
          const fields = r.fields as Record<string, unknown>;

          return {
            siren: fields.siren,
            denomination: fields.denomination,
            date_immatriculation: fields.date_immatriculation,
            ville: fields.ville,
            forme_juridique: fields.forme_juridique,
            secteur_d_activite: fields.secteur_d_activite,
            adresse: fields.adresse,
            code_postal: fields.code_postal,
          };
        }),
      });
    },
  });
}
