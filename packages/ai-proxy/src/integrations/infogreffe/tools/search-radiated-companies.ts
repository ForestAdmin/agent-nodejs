import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { buildQuery, searchV1Api } from '../utils';

export default function createSearchRadiatedCompaniesTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'infogreffe_search_radiated_companies',
    description:
      'Search for struck-off French companies by various criteria (city, sector, region, etc.)',
    schema: z.object({
      year: z.enum(['2022', '2023', '2024', '2025']).default('2024').describe('Radiation year'),
      ville: z.string().optional().describe('City (e.g., PARIS, LYON)'),
      region: z.string().optional().describe('Region (e.g., Ile-de-France)'),
      secteur_d_activite: z.string().optional().describe('Business sector'),
      forme_juridique: z.string().optional().describe('Legal form (e.g., SARL, SAS)'),
      limit: z.number().int().positive().default(10).describe('Maximum results (default: 10)'),
    }),
    func: async ({ year, ville, region, secteur_d_activite, forme_juridique, limit }) => {
      const dataset = `entreprises-radiees-en-${year}`;

      const query = buildQuery([
        ville && `ville:${ville}`,
        region && `region:${region}`,
        secteur_d_activite && `secteur_d_activite:${secteur_d_activite}`,
        forme_juridique && `forme_juridique:${forme_juridique}`,
      ]);

      const result = await searchV1Api(headers, dataset, query, limit);

      return JSON.stringify({
        annee: year,
        criteres: { ville, region, secteur_d_activite, forme_juridique },
        total_resultats: result.nhits,
        resultats_affiches: result.records.length,
        entreprises: result.records.map(r => {
          const fields = r.fields as Record<string, unknown>;

          return {
            siren: fields.siren,
            denomination: fields.denomination,
            date_radiation: fields.date_radiation,
            ville: fields.ville,
            forme_juridique: fields.forme_juridique,
            secteur_d_activite: fields.secteur_d_activite,
          };
        }),
      });
    },
  });
}
