/**
 * @forestadmin/datasource-demo-bank: a demo bank on a fresh SQLite database. Built like
 * @forestadmin/datasource-demo-fintech:
 *
 * 1. seed (seed/): a new SQLite file at every boot, every table of the data model (seed/data-model.ts)
 *    filled with consistent rows, the same on every run, dated from today, and the demo cases;
 * 2. introspect: the SQL data source discovers the tables; SQLite's text columns get their dropdowns
 *    and UUID types back (applyTypes);
 * 3. customize: the links of the data model, readable names and parent lists for every table
 *    (customizations/shared/), then one module per table (customizations/<table>.ts) with its Smart
 *    Actions, computed fields and evidence, then the API charts (charts/): weekly figures, queue
 *    counts, the data model's map.
 */
import type { DataSourceFactory } from '@forestadmin/datasource-toolkit';

import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import { rm } from 'fs/promises';

import { addCharts } from './charts/index';
import customizeAccounts from './customizations/accounts';
import { addShowcaseCases } from './customizations/actions/showcase';
import customizeAlerts from './customizations/alerts';
import customizeBusinesses from './customizations/businesses';
import customizeChargebacks from './customizations/chargebacks';
import customizeCustomers from './customizations/customers';
import customizeDisputeRequests from './customizations/dispute_requests';
import customizeDocuments from './customizations/documents';
import customizeIndividuals from './customizations/individuals';
import customizeInvestigations from './customizations/investigations';
import customizeInvoices from './customizations/invoices';
import customizeKycCases from './customizations/kyc_cases';
import customizeOutgoingTransfers from './customizations/outgoing_transfers';
import customizeSarReports from './customizations/sar_reports';
import customizeScreeningHits from './customizations/screening_hits';
import customizeSepaDisputes from './customizations/sepa_disputes';
import { addLinks } from './customizations/shared/links';
import { addReadableNames } from './customizations/shared/names';
import { addParentLists } from './customizations/shared/parent-lists';
import { DEFAULT_PORTAL_ORIGINS } from './customizations/shared/uploads';
import { seed } from './seed/index';
import { tables } from './seed/schema';

const STORAGE = 'db.sqlite';

/** SQLite stores enums and UUIDs as text: give Forest its dropdowns and UUID ids back. */
function applyTypes(dataSource) {
  Object.entries(tables).forEach(([table, { fields }]) => {
    const schemaFields = dataSource.getCollection(table).schema.fields;
    fields.forEach(field => {
      if (field.enum) {
        schemaFields[field.name].columnType = 'Enum';
        schemaFields[field.name].enumValues = [...field.enum];
      } else if (field.type === 'uuid') {
        schemaFields[field.name].columnType = 'Uuid';
      }
    });
  });
}

async function buildSeededSqlDataSource(logger, restartAgent) {
  await rm(STORAGE, { force: true });
  // With the demo's own KYC cases, kept out of every queue but their own (showcase.ts).
  await seed(STORAGE, addShowcaseCases);
  const dataSource = await createSqlDataSource({ dialect: 'sqlite', storage: STORAGE })(
    logger,
    restartAgent,
  );
  applyTypes(dataSource);

  return dataSource;
}

export type DemoBankOptions = {
  /**
   * The partner portal addresses the "Upload document" Smart Action fetches files from.
   * Default: http://localhost:3500 and http://127.0.0.1:3500.
   */
  partnerPortalOrigins?: string[];
};

// eslint-disable-next-line import/prefer-default-export
export function createDemoBankDataSource(options: DemoBankOptions = {}): DataSourceFactory {
  const partnerPortalOrigins = options.partnerPortalOrigins ?? DEFAULT_PORTAL_ORIGINS;
  const customizer = new DataSourceCustomizer();
  customizer.addDataSource(buildSeededSqlDataSource);

  // Every table: the links of the data model, a readable name, its parents as lists.
  addLinks(customizer);
  addReadableNames(customizer);
  addParentLists(customizer);

  // One module per table: Smart Actions, computed fields, the evidence fields.
  customizer.customizeCollection('individuals', customizeIndividuals);
  customizer.customizeCollection('accounts', customizeAccounts);
  customizer.customizeCollection('documents', customizeDocuments);
  customizer.customizeCollection('chargebacks', customizeChargebacks);
  customizer.customizeCollection('invoices', customizeInvoices);
  customizer.customizeCollection('kyc_cases', collection =>
    customizeKycCases(collection, { partnerPortalOrigins }),
  );
  customizer.customizeCollection('customers', customizeCustomers);
  customizer.customizeCollection('alerts', customizeAlerts);
  customizer.customizeCollection('screening_hits', customizeScreeningHits);
  customizer.customizeCollection('investigations', customizeInvestigations);
  customizer.customizeCollection('sar_reports', customizeSarReports);
  customizer.customizeCollection('outgoing_transfers', customizeOutgoingTransfers);
  customizer.customizeCollection('dispute_requests', customizeDisputeRequests);
  customizer.customizeCollection('sepa_disputes', customizeSepaDisputes);
  customizer.customizeCollection('businesses', customizeBusinesses);

  addCharts(customizer);

  return customizer.getFactory();
}
