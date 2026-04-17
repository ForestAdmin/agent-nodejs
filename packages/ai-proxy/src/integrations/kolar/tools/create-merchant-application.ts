import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { assertResponseOk } from '../utils';

export default function createMerchantApplicationTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'kolar_create_merchant_application',
    description:
      'Submit a merchant application for KYB analysis. Creates the application, triggers analysis, and returns the application ID to use with kolar_get_merchant_application_result.',
    schema: z.object({
      companyName: z.string().describe('Company legal name'),
      companySiren: z.string().describe('Company SIREN number'),
      websiteUrl: z.string().describe('Company website URL'),
      legalRepName: z.string().describe('Legal representative full name'),
      emailDomain: z.string().optional().describe('Company email domain'),
      phone: z.string().optional().describe('Company phone number'),
      legalRepDob: z.string().optional().describe('Legal representative date of birth (ISO 8601)'),
      expectedMonthlyPaymentVolume: z
        .string()
        .optional()
        .describe('Expected monthly payment volume'),
      expectedAverageBasketValue: z.string().optional().describe('Expected average basket value'),
      businessDescription: z.string().optional().describe('Description of the business activity'),
    }),
    func: async inputs => {
      const createResponse = await fetch(`${baseUrl}/merchant-application/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify(inputs),
      });

      await assertResponseOk(createResponse, 'create merchant application');
      const { id } = await createResponse.json();

      const jobResponse = await fetch(`${baseUrl}/merchant-application-job/create/${id}`, {
        method: 'POST',
        headers,
      });

      await assertResponseOk(jobResponse, 'trigger merchant application analysis');

      return JSON.stringify({ id });
    },
  });
}
