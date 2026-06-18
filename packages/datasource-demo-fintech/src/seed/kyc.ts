import type { Customer, Row } from './types';
import type { Knex } from 'knex';

import { daysAgo } from './dates';
import { DOC_TYPES } from './pools';
import { chance, insertAll, pick, randint, sample } from './utils';

/**
 * Opens KYC cases (1–2 per customer) plus their documents. Case status mirrors the
 * customer's compliance profile: sanctioned/PEP customers escalate, approved ones
 * tend to resolve cleanly.
 */
export default async function seedKyc(knex: Knex, customers: Customer[]): Promise<void> {
  await knex.schema.createTable('kyc_cases', table => {
    table.increments('id').primary();
    table.integer('customer_id');
    table.string('status');
    table.datetime('opened_at');
    table.datetime('resolved_at');
    table.string('rejection_reason');
    table.string('escalation_reason');
    table.string('notes');
  });

  await knex.schema.createTable('kyc_documents', table => {
    table.increments('id').primary();
    table.integer('kyc_case_id');
    table.integer('customer_id');
    table.string('document_type');
    table.string('file_url');
    table.datetime('uploaded_at');
    table.boolean('verified');
    table.datetime('verified_at');
  });

  const kycCases: Row[] = [];
  const docs: Row[] = [];
  let kid = 0;
  let did = 0;

  for (const c of customers) {
    const ncases = chance(0.85) ? 1 : 2;

    for (let k = 0; k < ncases; k += 1) {
      kid += 1;
      let st: string;
      if (c.is_sanctioned) st = pick(['ESCALATED', 'REJECTED']);
      else if (c.is_pep) st = pick(['ESCALATED', 'IN_REVIEW', 'PENDING_APPROVAL']);
      else if (c.onboarding_status === 'APPROVED') st = pick(['APPROVED', 'APPROVED', 'IN_REVIEW']);
      else if (c.onboarding_status === 'REJECTED') st = 'REJECTED';
      else if (c.risk_rating === 'HIGH') st = pick(['ESCALATED', 'IN_REVIEW', 'PENDING_APPROVAL']);
      else st = pick(['IN_REVIEW', 'PENDING_APPROVAL', 'OPEN']);
      const opened = randint(30, 210);
      kycCases.push({
        id: kid,
        customer_id: c.id,
        status: st,
        opened_at: daysAgo(opened),
        resolved_at: ['APPROVED', 'REJECTED'].includes(st)
          ? daysAgo(randint(1, Math.max(2, opened - 10)))
          : null,
        rejection_reason:
          st === 'REJECTED'
            ? pick(['Document mismatch', 'Failed liveness check', 'Sanctions concern'])
            : null,
        escalation_reason:
          st === 'ESCALATED'
            ? pick([
                'PEP match requires senior review',
                'High-risk jurisdiction',
                'Adverse media hit',
              ])
            : null,
        notes: chance(0.5)
          ? null
          : pick([
              'Awaiting proof of address.',
              'Customer responsive.',
              'Second review scheduled.',
              'Source of funds requested.',
            ]),
      });

      for (const dt of sample(DOC_TYPES, randint(2, 5))) {
        did += 1;
        const verified = st === 'APPROVED' || chance(0.5);
        const up = randint(1, Math.max(2, opened - 2));
        docs.push({
          id: did,
          kyc_case_id: kid,
          customer_id: c.id,
          document_type: dt,
          file_url: `https://kyc.neobank.eu/docs/${c.id}/${dt.toLowerCase()}.pdf`,
          uploaded_at: daysAgo(up),
          verified,
          verified_at: verified ? daysAgo(randint(1, up)) : null,
        });
      }
    }
  }

  await insertAll(knex, 'kyc_cases', kycCases);
  await insertAll(knex, 'kyc_documents', docs);
}
