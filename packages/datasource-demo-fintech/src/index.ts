import type {
  ColumnSchema,
  DataSource,
  DataSourceFactory,
  Logger,
} from '@forestadmin/datasource-toolkit';

import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import { rm } from 'fs/promises';

import customizeAmlAlerts from './customizations/aml_alerts';
import customizeCards from './customizations/cards';
import customizeChargebacks from './customizations/chargebacks';
import customizeCustomers from './customizations/customers';
import customizeKycCases from './customizations/kyc_cases';
import customizeKycDocuments from './customizations/kyc_documents';
import customizeRefundRequests from './customizations/refund_requests';
import customizeSarReports from './customizations/sar_reports';
import seed from './seed';
import {
  AML_SEVERITIES,
  AML_STATUSES,
  ATYPES,
  CARD_STATUSES,
  CARD_TYPES,
  CB_STATUS,
  DOC_TYPES,
  KYC_STATUSES,
  NETWORKS,
  ONBOARDING_STATUSES,
  REFUND_REASONS,
  REFUND_STATUSES,
  RISK_RATINGS,
  SAR_STATUSES,
  SOURCES,
} from './seed/pools';

// Categorical columns are stored as plain text in SQLite, so introspection types
// them as `String`. We re-type them as `Enum` to restore Forest's dropdowns. The
// value lists are the seed's enum domains (single source of truth), extended with
// the values that only Smart Actions write (`SAR_FILED`, `DISMISSED`) so re-typing
// never rejects a legitimate value.
const ENUM_FIELDS: Record<string, Record<string, readonly string[]>> = {
  customers: {
    onboarding_status: ONBOARDING_STATUSES,
    risk_rating: RISK_RATINGS,
  },
  cards: {
    card_type: CARD_TYPES,
    status: CARD_STATUSES,
  },
  aml_alerts: {
    alert_type: ATYPES,
    severity: AML_SEVERITIES,
    status: [...AML_STATUSES, 'SAR_FILED'],
  },
  kyc_cases: {
    status: KYC_STATUSES,
  },
  kyc_documents: {
    document_type: DOC_TYPES,
  },
  chargebacks: {
    status: [...CB_STATUS, 'DISMISSED'],
    network: NETWORKS,
    source: SOURCES,
  },
  refund_requests: {
    status: REFUND_STATUSES,
    reason: REFUND_REASONS,
  },
  sar_reports: {
    status: SAR_STATUSES,
    activity_type: ATYPES,
  },
};

/** Re-types the categorical columns of the introspected schema as enums in place. */
function applyEnums(dataSource: DataSource): void {
  for (const [collectionName, fields] of Object.entries(ENUM_FIELDS)) {
    const { fields: schemaFields } = dataSource.getCollection(collectionName).schema;

    for (const [fieldName, enumValues] of Object.entries(fields)) {
      const column = schemaFields[fieldName] as ColumnSchema;
      column.columnType = 'Enum';
      column.enumValues = [...enumValues];
    }
  }
}

/**
 * Builds a throwaway SQLite database, seeds it with the demo dataset, and exposes
 * it through the SQL data source. Schema, relations and types are introspected
 * from the freshly-created tables. A new database is generated on every boot.
 */
async function buildSeededSqlDataSource(
  logger: Logger,
  restartAgent: () => Promise<void>,
): Promise<DataSource> {
  const storage = 'db.sqlite';
  await rm(storage, { force: true });

  await seed(storage);

  const ds = await createSqlDataSource({ dialect: 'sqlite', storage })(logger, restartAgent);

  applyEnums(ds);

  return ds;
}

// eslint-disable-next-line import/prefer-default-export
export function createDemoFintechDataSource(): DataSourceFactory {
  const customizer = new DataSourceCustomizer();

  customizer.addDataSource(buildSeededSqlDataSource);

  // Each module wires that collection's relationships, computed fields,
  // segments and Smart Actions. Relations centre on `customers`.
  customizer.customizeCollection('customers', customizeCustomers);
  customizer.customizeCollection('cards', customizeCards);
  customizer.customizeCollection('aml_alerts', customizeAmlAlerts);
  customizer.customizeCollection('kyc_cases', customizeKycCases);
  customizer.customizeCollection('kyc_documents', customizeKycDocuments);
  customizer.customizeCollection('chargebacks', customizeChargebacks);
  customizer.customizeCollection('refund_requests', customizeRefundRequests);
  customizer.customizeCollection('sar_reports', customizeSarReports);

  return customizer.getFactory();
}
