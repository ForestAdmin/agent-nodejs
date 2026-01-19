import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { searchV1Api } from '../utils';

export default function createGetFinancialIndicatorsTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'infogreffe_get_financial_indicators',
    description:
      'Get financial indicators for a French company (revenue, operating result, headcount) for the last 3 fiscal years',
    schema: z.object({
      siren: z.string().length(9).describe('SIREN number (9 digits)'),
    }),
    func: async ({ siren }) => {
      const result = await searchV1Api(headers, 'chiffres-cles-2024', `siren:${siren}`, 1);

      if (result.nhits === 0) {
        return JSON.stringify({
          siren,
          found: false,
          message: 'No financial data available for this company',
        });
      }

      const fields = result.records[0].fields as Record<string, unknown>;

      return JSON.stringify({
        siren,
        found: true,
        denomination: fields.denomination,
        forme_juridique: fields.forme_juridique,
        secteur: fields.libelle_ape,
        ville: fields.ville,
        exercices: {
          millesime_1: {
            annee: fields.millesime_1,
            ca: fields.ca_1 ?? 'Confidential',
            tranche_ca: fields.tranche_ca_millesime_1,
            resultat: fields.resultat_1 ?? 'Confidential',
            effectif: fields.effectif_1 ?? 'Confidential',
            duree: fields.duree_1,
            date_cloture: fields.date_de_cloture_exercice_1,
          },
          millesime_2: {
            annee: fields.millesime_2,
            ca: fields.ca_2 ?? 'Confidential',
            tranche_ca: fields.tranche_ca_millesime_2,
            resultat: fields.resultat_2 ?? 'Confidential',
            effectif: fields.effectif_2 ?? 'Confidential',
            duree: fields.duree_2,
            date_cloture: fields.date_de_cloture_exercice_2,
          },
          millesime_3: {
            annee: fields.millesime_3,
            ca: fields.ca_3 ?? 'Confidential',
            tranche_ca: fields.tranche_ca_millesime_3,
            resultat: fields.resultat_3 ?? 'Confidential',
            effectif: fields.effectif_3 ?? 'Confidential',
            duree: fields.duree_3,
            date_cloture: fields.date_de_cloture_exercice_3,
          },
        },
      });
    },
  });
}
