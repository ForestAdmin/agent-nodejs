import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { searchV1Api } from '../utils';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface RiskFactor {
  type: string;
  severity: RiskLevel;
  description: string;
  date?: string;
  date_immatriculation?: string;
}

const RECOMMENDATIONS: Record<RiskLevel, string> = {
  CRITICAL: 'DO NOT ONBOARD - Company struck off or major risk',
  HIGH: 'CAUTION - Manual verification required',
  MEDIUM: 'VIGILANCE - Monitor closely',
  LOW: 'Acceptable - Low risk',
};

function calculateRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';

  return 'LOW';
}

export default function createAssessCompanyRiskTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'infogreffe_assess_company_risk',
    description:
      'Assess risk for a French company for KYC/KYB. Checks radiations, company age, etc. Returns a risk score',
    schema: z
      .object({
        siren: z.string().length(9).optional().describe('SIREN number (9 digits)'),
        denomination: z.string().optional().describe('Company name'),
      })
      .refine(data => data.siren || data.denomination, {
        message: 'Either siren or denomination is required',
      }),
    func: async ({ siren, denomination }) => {
      const riskFactors: RiskFactor[] = [];
      let riskScore = 0;

      const query = siren ? `siren:${siren}` : `denomination:${denomination}`;

      const radiationResults = await Promise.all(
        [2025, 2024].map(async year => {
          const result = await searchV1Api(headers, `entreprises-radiees-en-${year}`, query, 1);

          return { year, result };
        }),
      );

      for (const { year, result } of radiationResults) {
        if (result.nhits > 0) {
          const fields = result.records[0].fields as Record<string, unknown>;
          riskScore += 100;
          riskFactors.push({
            type: 'RADIATION',
            severity: 'CRITICAL',
            description: `Company struck off in ${year}`,
            date: fields.date_radiation as string,
          });
          break;
        }
      }

      if (siren) {
        const result = await searchV1Api(
          headers,
          'entreprises-immatriculees-en-2024',
          `siren:${siren}`,
          1,
        );

        if (result.nhits > 0) {
          const fields = result.records[0].fields as Record<string, unknown>;
          const dateImmat = fields.date_immatriculation as string;

          if (dateImmat) {
            const immatDate = new Date(dateImmat);
            const ageDays = Math.floor((Date.now() - immatDate.getTime()) / (1000 * 60 * 60 * 24));

            if (ageDays < 90) {
              riskScore += 30;
              riskFactors.push({
                type: 'YOUNG_COMPANY',
                severity: 'HIGH',
                description: `Very recent company (${ageDays} days)`,
                date_immatriculation: dateImmat,
              });
            } else if (ageDays < 180) {
              riskScore += 15;
              riskFactors.push({
                type: 'YOUNG_COMPANY',
                severity: 'MEDIUM',
                description: `Recent company (${ageDays} days)`,
                date_immatriculation: dateImmat,
              });
            }
          }
        }
      }

      const riskLevel = calculateRiskLevel(riskScore);

      return JSON.stringify({
        siren,
        denomination,
        risk_score: riskScore,
        risk_level: riskLevel,
        risk_factors: riskFactors,
        recommendation: RECOMMENDATIONS[riskLevel],
      });
    },
  });
}
