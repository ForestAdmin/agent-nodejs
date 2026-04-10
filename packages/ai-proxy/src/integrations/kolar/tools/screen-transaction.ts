import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { assertResponseOk } from '../utils';

export default function createScreenTransactionTool(
  headers: Record<string, string>,
  baseUrl: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'kolar_screen_transaction',
    description:
      'Submit a transaction for AML risk screening. Creates an alert and triggers the screening job. Returns the alert ID to use with kolar_get_screening_result.',
    schema: z.object({
      clientFirstName: z.string().describe('Client first name'),
      clientLastName: z.string().describe('Client last name'),
      matchFirstNames: z.string().describe('Match first names'),
      matchLastNames: z.string().describe('Match last names'),
      matchType: z
        .enum(['PEP', 'SL'])
        .describe('Match type: PEP (Politically Exposed Person) or SL (Sanctions List)'),
      clientBirthDate: z.string().optional().describe('Client birth date (ISO 8601)'),
      clientBirthPlace: z.string().optional().describe('Client birth place'),
      clientIdFirstName: z.string().optional().describe('Client ID first name'),
      clientIdLastName: z.string().optional().describe('Client ID last name'),
      clientIdBirthDate: z.string().optional().describe('Client ID birth date (ISO 8601)'),
      clientIdBirthPlace: z.string().optional().describe('Client ID birth place'),
      clientIdCountryCode: z.string().optional().describe('Client ID country code'),
      onfidoCountryCode: z.string().optional().describe('Onfido country code'),
      clientPhoneCountryCode: z.string().optional().describe('Client phone country code'),
      merchantBrand: z.string().optional().describe('Merchant brand'),
      paymentIpAddress: z.string().optional().describe('Payment IP address'),
      paymentCountry: z.string().optional().describe('Payment country'),
      shippingCountry: z.string().optional().describe('Shipping country'),
      billingCountry: z.string().optional().describe('Billing country'),
      cardHolderName: z.string().optional().describe('Card holder name'),
      cardCountryCode: z.string().optional().describe('Card country code'),
      bankAccountHolderName: z.string().optional().describe('Bank account holder name'),
      bankAccountCountryCode: z.string().optional().describe('Bank account country code'),
      matchFullNames: z.string().optional().describe('Match full names'),
      matchBirthDate: z.string().optional().describe('Match birth date (ISO 8601)'),
      matchBirthPlace: z.string().optional().describe('Match birth place'),
      matchCountryCode: z.string().optional().describe('Match country code'),
      matchRole: z.string().optional().describe('Match role'),
      additionalData: z.record(z.string(), z.unknown()).optional().describe('Additional data'),
    }),
    func: async inputs => {
      const createResponse = await fetch(`${baseUrl}/alert/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify(inputs),
      });

      await assertResponseOk(createResponse, 'create alert');
      const { id } = await createResponse.json();

      const jobResponse = await fetch(`${baseUrl}/alert-job/create/${id}`, {
        method: 'POST',
        headers,
      });

      await assertResponseOk(jobResponse, 'create alert job');

      return JSON.stringify({ id });
    },
  });
}
