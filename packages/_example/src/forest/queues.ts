import type { Schema } from './typings';
import type { CollectionCustomizer, TCollectionName, TConditionTree } from '@forestadmin/agent';

type Condition = { field: string; operator: string; value: unknown };
type Tree = Condition | { aggregator: 'And'; conditions: Condition[] };

const is = (field: string, value: unknown): Condition => ({ field, operator: 'Equal', value });
const isNot = (field: string, value: unknown): Condition => ({
  field,
  operator: 'NotEqual',
  value,
});
const anyOf = (field: string, values: unknown[]): Condition => ({
  field,
  operator: 'In',
  value: values,
});
const and = (...conditions: Condition[]): Tree => ({ aggregator: 'And', conditions });

export const QUEUES: Record<string, [TCollectionName<Schema>, string, Tree]> = {
  kyc_retail: [
    'kyc_cases',
    'Retail onboarding',
    and(
      is('type', 'ONBOARDING'),
      is('customer:customer_type', 'RETAIL'),
      anyOf('status', ['OPEN', 'IN_REVIEW']),
      isNot('risk_before', 'LOW'),
    ),
  ],
  kyc_retail_auto: [
    'kyc_cases',
    'Retail onboarding: automatic',
    and(
      is('type', 'ONBOARDING'),
      is('customer:customer_type', 'RETAIL'),
      is('status', 'OPEN'),
      is('risk_before', 'LOW'),
    ),
  ],
  kyc_retail_auto_runs: [
    'kyc_cases',
    'Automatic onboarding: results',
    and(is('type', 'ONBOARDING'), is('customer:customer_type', 'RETAIL'), is('risk_before', 'LOW')),
  ],
  kyc_senior: [
    'kyc_cases',
    'Senior sign-off',
    and(
      is('type', 'ONBOARDING'),
      is('customer:customer_type', 'RETAIL'),
      is('status', 'PENDING_APPROVAL'),
    ),
  ],
  kyc_business: [
    'kyc_cases',
    'Business onboarding',
    and(
      is('type', 'ONBOARDING'),
      is('customer:customer_type', 'BUSINESS'),
      anyOf('status', ['OPEN', 'IN_REVIEW']),
    ),
  ],
  kyc_parked: [
    'kyc_cases',
    'Parked for screening',
    and(is('status', 'ESCALATED'), is('escalation_reason', 'Screening hit to review')),
  ],
  kyc_other: [
    'kyc_cases',
    'Other KYC reviews',
    and(isNot('type', 'ONBOARDING'), anyOf('status', ['OPEN', 'IN_REVIEW'])),
  ],
  alerts_aml: [
    'alerts',
    'AML alerts to review',
    and(is('category', 'AML'), anyOf('status', ['OPEN', 'IN_REVIEW'])),
  ],
  alerts_fraud: [
    'alerts',
    'Fraud and takeover alerts',
    and(anyOf('category', ['FRAUD', 'ACCOUNT_TAKEOVER']), anyOf('status', ['OPEN', 'IN_REVIEW'])),
  ],
  inv_open: ['investigations', 'Open investigations', anyOf('status', ['OPEN', 'IN_PROGRESS'])],
  mlro_signoff: ['investigations', 'Waiting for MLRO', is('status', 'PENDING_MLRO')],
  sar_draft: ['sar_reports', 'SARs to file', is('status', 'DRAFT')],
  sar_tracfin: [
    'sar_reports',
    'Waiting for TRACFIN',
    anyOf('status', ['SUBMITTED', 'ACKNOWLEDGED']),
  ],
  disputes_new: ['dispute_requests', 'New disputes', is('status', 'NEW')],
  cb_open: ['chargebacks', 'Chargebacks to file', is('status', 'INITIATED')],
  cb_contested: ['chargebacks', 'Merchant answered', is('status', 'REPRESENTED')],
};

export function addQueues<N extends TCollectionName<Schema>>(
  collection: CollectionCustomizer<Schema, N>,
) {
  Object.values(QUEUES)
    .filter(([table]) => table === collection.name)
    .forEach(([, name, tree]) =>
      collection.addSegment(name, tree as unknown as TConditionTree<Schema, N>),
    );

  return collection;
}
