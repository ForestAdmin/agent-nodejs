/**
 * @forestadmin/datasource-demo-bank: a demo bank on a fresh SQLite database, the data source of the
 * Forest CLI's demo. Built like @forestadmin/datasource-demo-fintech:
 *
 * 1. seed (seed/): a new SQLite file at every boot, every table of the data model (model/schema.json)
 *    filled with consistent rows, the same on every run, dated from today; then the demo cases;
 * 2. introspect: the SQL data source discovers the tables; SQLite's text columns get their dropdowns
 *    and UUID types back (applyTypes);
 * 3. customize: the links of the data model, readable names and parent lists for every table
 *    (customizations/shared/), then one module per table (customizations/<table>.js) with its Smart
 *    Actions, computed fields and evidence, then the API charts the demo's workspaces read (charts/).
 */
const { DataSourceCustomizer } = require('@forestadmin/datasource-customizer');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');
const { rm } = require('fs/promises');

const { withFeatureSource } = require('./charts/features');
const { addCharts } = require('./charts/index');
const customizeAccounts = require('./customizations/accounts');
const { addShowcaseCases } = require('./customizations/actions/showcase');
const customizeAlerts = require('./customizations/alerts');
const customizeBusinesses = require('./customizations/businesses');
const customizeChargebacks = require('./customizations/chargebacks');
const customizeCustomers = require('./customizations/customers');
const customizeDisputeRequests = require('./customizations/dispute_requests');
const customizeDocuments = require('./customizations/documents');
const customizeIndividuals = require('./customizations/individuals');
const customizeInvestigations = require('./customizations/investigations');
const customizeInvoices = require('./customizations/invoices');
const customizeKycCases = require('./customizations/kyc_cases');
const customizeOutgoingTransfers = require('./customizations/outgoing_transfers');
const customizeSarReports = require('./customizations/sar_reports');
const customizeScreeningHits = require('./customizations/screening_hits');
const customizeSepaDisputes = require('./customizations/sepa_disputes');
const { addLinks } = require('./customizations/shared/links');
const { addReadableNames } = require('./customizations/shared/names');
const { addParentLists } = require('./customizations/shared/parent-lists');
const { tables } = require('./model/schema');
const { seed } = require('./seed/index');

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
  await seed(STORAGE);
  // The demo's two KYC cases, kept out of every queue but the KYC case desk's (showcase.js).
  await addShowcaseCases(STORAGE);
  const dataSource = await createSqlDataSource({ dialect: 'sqlite', storage: STORAGE })(
    logger,
    restartAgent,
  );
  applyTypes(dataSource);

  return dataSource;
}

/** @returns {import('@forestadmin/datasource-toolkit').DataSourceFactory} */
function createDemoBankDataSource() {
  const customizer = new DataSourceCustomizer();
  customizer.addDataSource(buildSeededSqlDataSource);

  // Every table: the links of the data model, a readable name, its parents as lists.
  addLinks(customizer);
  addReadableNames(customizer);
  addParentLists(customizer);

  // One module per table: Smart Actions, computed fields, the evidence the workflows read.
  customizer.customizeCollection('individuals', customizeIndividuals);
  customizer.customizeCollection('accounts', customizeAccounts);
  customizer.customizeCollection('documents', customizeDocuments);
  customizer.customizeCollection('chargebacks', customizeChargebacks);
  customizer.customizeCollection('invoices', customizeInvoices);
  customizer.customizeCollection('kyc_cases', customizeKycCases);
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

  // Remembered for the explainers' Smart Actions figure (charts/features.js).
  return withFeatureSource(customizer.getFactory());
}

module.exports = { createDemoBankDataSource };
