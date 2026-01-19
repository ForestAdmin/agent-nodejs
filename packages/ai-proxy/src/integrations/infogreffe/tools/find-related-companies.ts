import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { searchV1Api } from '../utils';

export default function createFindRelatedCompaniesTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'infogreffe_find_related_companies',
    description: 'Find related French companies (same address, same sector in same area, etc.)',
    schema: z.object({
      siren: z.string().length(9).optional().describe('Reference company SIREN'),
      adresse: z.string().optional().describe('Address to search'),
      search_type: z
        .enum(['same_address', 'same_sector'])
        .default('same_address')
        .describe('Search type: same_address or same_sector (same sector + city)'),
      limit: z.number().int().positive().default(20).describe('Maximum results (default: 20)'),
    }),
    func: async ({ siren, adresse, search_type, limit }) => {
      let searchAddress = adresse;
      let ville: unknown;
      let secteur: unknown;

      if (siren && !adresse) {
        const result = await searchV1Api(
          headers,
          'entreprises-immatriculees-en-2024',
          `siren:${siren}`,
          1,
        );

        if (result.nhits > 0) {
          const fields = result.records[0].fields as Record<string, unknown>;
          searchAddress = fields.adresse as string;
          ville = fields.ville;
          secteur = fields.secteur_d_activite;
        }
      }

      if (!searchAddress && search_type === 'same_address') {
        return JSON.stringify({
          error: 'Address required or valid SIREN to lookup address',
        });
      }

      let query: string;

      if (search_type === 'same_address') {
        query = `adresse:"${searchAddress}"`;
      } else {
        if (!ville || !secteur) {
          return JSON.stringify({
            error: 'Cannot determine city and sector for same_sector search',
          });
        }

        query = `ville:${ville} AND secteur_d_activite:"${secteur}"`;
      }

      const result = await searchV1Api(headers, 'entreprises-immatriculees-en-2024', query, limit);

      return JSON.stringify({
        critere_recherche: {
          siren_reference: siren,
          adresse: searchAddress,
          type: search_type,
        },
        total_resultats: result.nhits,
        entreprises_liees: result.records
          .filter(r => {
            const fields = r.fields as Record<string, unknown>;

            return fields.siren !== siren;
          })
          .map(r => {
            const fields = r.fields as Record<string, unknown>;

            return {
              siren: fields.siren,
              denomination: fields.denomination,
              adresse: fields.adresse,
              ville: fields.ville,
              forme_juridique: fields.forme_juridique,
              date_immatriculation: fields.date_immatriculation,
            };
          }),
      });
    },
  });
}
