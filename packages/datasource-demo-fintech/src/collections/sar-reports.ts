import type { DataSource, FieldSchema, RecordData } from '@forestadmin/datasource-toolkit';

import BaseFintechCollection from './base';
import { dayOnlyAgo, daysAgo } from '../dates';

export default class SarReportsCollection extends BaseFintechCollection {
  private static schema: Record<string, FieldSchema> = {
    id: {
      type: 'Column',
      columnType: 'Number',
      isPrimaryKey: true,
    },
    alert_id: {
      type: 'Column',
      columnType: 'Number',
    },
    customer_id: {
      type: 'Column',
      columnType: 'Number',
    },
    reference: {
      type: 'Column',
      columnType: 'String',
    },
    status: {
      type: 'Column',
      columnType: 'String',
    },
    activity_type: {
      type: 'Column',
      columnType: 'String',
    },
    activity_start_date: {
      type: 'Column',
      columnType: 'Dateonly',
    },
    activity_end_date: {
      type: 'Column',
      columnType: 'Dateonly',
    },
    total_amount: {
      type: 'Column',
      columnType: 'Number',
    },
    transaction_count: {
      type: 'Column',
      columnType: 'Number',
    },
    narrative: {
      type: 'Column',
      columnType: 'String',
    },
    filed_at: {
      type: 'Column',
      columnType: 'Date',
    },
    created_at: {
      type: 'Column',
      columnType: 'Date',
    },
  };

  protected override records: RecordData[] = [
    {
      id: 1,
      alert_id: 2,
      customer_id: 146,
      reference: 'SAR-2026-00001',
      status: 'DRAFT',
      activity_type: 'RAPID_MOVEMENT',
      activity_start_date: dayOnlyAgo(95),
      activity_end_date: dayOnlyAgo(19),
      total_amount: 111511.27,
      transaction_count: 3,
      narrative:
        'Suspicious activity consistent with rapid movement detected over 76 days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.',
      filed_at: null,
      created_at: daysAgo(20),
    },
    {
      id: 2,
      alert_id: 11,
      customer_id: 95,
      reference: 'SAR-2026-00002',
      status: 'DRAFT',
      activity_type: 'STRUCTURING',
      activity_start_date: dayOnlyAgo(72),
      activity_end_date: dayOnlyAgo(34),
      total_amount: 82275.57,
      transaction_count: 7,
      narrative:
        'Suspicious activity consistent with structuring detected over 38 days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.',
      filed_at: daysAgo(8),
      created_at: daysAgo(35),
    },
    {
      id: 3,
      alert_id: 14,
      customer_id: 85,
      reference: 'SAR-2026-00003',
      status: 'DRAFT',
      activity_type: 'RAPID_MOVEMENT',
      activity_start_date: dayOnlyAgo(101),
      activity_end_date: dayOnlyAgo(6),
      total_amount: 144191.03,
      transaction_count: 49,
      narrative:
        'Suspicious activity consistent with rapid movement detected over 95 days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.',
      filed_at: daysAgo(4),
      created_at: daysAgo(11),
    },
    {
      id: 4,
      alert_id: 23,
      customer_id: 132,
      reference: 'SAR-2026-00004',
      status: 'SUBMITTED',
      activity_type: 'SANCTIONS_MATCH',
      activity_start_date: dayOnlyAgo(68),
      activity_end_date: dayOnlyAgo(15),
      total_amount: 106775.16,
      transaction_count: 68,
      narrative:
        'Suspicious activity consistent with sanctions match detected over 53 days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.',
      filed_at: null,
      created_at: daysAgo(16),
    },
    {
      id: 5,
      alert_id: 25,
      customer_id: 102,
      reference: 'SAR-2026-00005',
      status: 'SUBMITTED',
      activity_type: 'HIGH_RISK_COUNTRY',
      activity_start_date: dayOnlyAgo(101),
      activity_end_date: dayOnlyAgo(17),
      total_amount: 44967.41,
      transaction_count: 3,
      narrative:
        'Suspicious activity consistent with high risk country detected over 84 days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.',
      filed_at: null,
      created_at: daysAgo(19),
    },
    {
      id: 6,
      alert_id: 28,
      customer_id: 125,
      reference: 'SAR-2026-00006',
      status: 'DRAFT',
      activity_type: 'SANCTIONS_MATCH',
      activity_start_date: dayOnlyAgo(77),
      activity_end_date: dayOnlyAgo(31),
      total_amount: 171317.49,
      transaction_count: 42,
      narrative:
        'Suspicious activity consistent with sanctions match detected over 46 days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.',
      filed_at: daysAgo(21),
      created_at: daysAgo(32),
    },
    {
      id: 7,
      alert_id: 40,
      customer_id: 120,
      reference: 'SAR-2026-00007',
      status: 'SUBMITTED',
      activity_type: 'SANCTIONS_MATCH',
      activity_start_date: dayOnlyAgo(99),
      activity_end_date: dayOnlyAgo(32),
      total_amount: 116802.5,
      transaction_count: 22,
      narrative:
        'Suspicious activity consistent with sanctions match detected over 67 days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.',
      filed_at: daysAgo(30),
      created_at: daysAgo(35),
    },
    {
      id: 8,
      alert_id: 43,
      customer_id: 40,
      reference: 'SAR-2026-00008',
      status: 'SUBMITTED',
      activity_type: 'SANCTIONS_MATCH',
      activity_start_date: dayOnlyAgo(100),
      activity_end_date: dayOnlyAgo(32),
      total_amount: 46371.35,
      transaction_count: 47,
      narrative:
        'Suspicious activity consistent with sanctions match detected over 68 days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.',
      filed_at: daysAgo(22),
      created_at: daysAgo(33),
    },
    {
      id: 9,
      alert_id: 46,
      customer_id: 89,
      reference: 'SAR-2026-00009',
      status: 'FILED',
      activity_type: 'SUSPICIOUS_PATTERN',
      activity_start_date: dayOnlyAgo(106),
      activity_end_date: dayOnlyAgo(7),
      total_amount: 15599.82,
      transaction_count: 13,
      narrative:
        'Suspicious activity consistent with suspicious pattern detected over 99 days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.',
      filed_at: daysAgo(5),
      created_at: daysAgo(8),
    },
    {
      id: 10,
      alert_id: 53,
      customer_id: 120,
      reference: 'SAR-2026-00010',
      status: 'DRAFT',
      activity_type: 'STRUCTURING',
      activity_start_date: dayOnlyAgo(92),
      activity_end_date: dayOnlyAgo(27),
      total_amount: 25001.12,
      transaction_count: 80,
      narrative:
        'Suspicious activity consistent with structuring detected over 65 days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.',
      filed_at: null,
      created_at: daysAgo(28),
    },
    {
      id: 11,
      alert_id: 55,
      customer_id: 132,
      reference: 'SAR-2026-00011',
      status: 'FILED',
      activity_type: 'SANCTIONS_MATCH',
      activity_start_date: dayOnlyAgo(67),
      activity_end_date: dayOnlyAgo(15),
      total_amount: 218619.22,
      transaction_count: 43,
      narrative:
        'Suspicious activity consistent with sanctions match detected over 52 days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.',
      filed_at: null,
      created_at: daysAgo(17),
    },
    {
      id: 12,
      alert_id: 62,
      customer_id: 146,
      reference: 'SAR-2026-00012',
      status: 'SUBMITTED',
      activity_type: 'SANCTIONS_MATCH',
      activity_start_date: dayOnlyAgo(117),
      activity_end_date: dayOnlyAgo(17),
      total_amount: 67894.69,
      transaction_count: 61,
      narrative:
        'Suspicious activity consistent with sanctions match detected over 100 days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.',
      filed_at: daysAgo(16),
      created_at: daysAgo(19),
    },
  ];

  constructor(datasource: DataSource) {
    super(datasource, 'sar_reports', SarReportsCollection.schema);
  }
}
