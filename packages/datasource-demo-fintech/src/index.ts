import type { DataSourceFactory } from '@forestadmin/datasource-toolkit';

import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';

import customizeAmlAlerts from './customizations/aml_alerts';
import customizeCards from './customizations/cards';
import customizeChargebacks from './customizations/chargebacks';
import customizeCustomers from './customizations/customers';
import customizeKycCases from './customizations/kyc_cases';
import customizeKycDocuments from './customizations/kyc_documents';
import customizeRefundRequests from './customizations/refund_requests';
import customizeSarReports from './customizations/sar_reports';
import DemoFintechDataSource from './datasource';

// eslint-disable-next-line import/prefer-default-export
export function createDemoFintechDataSource(): DataSourceFactory {
  const customizer = new DataSourceCustomizer();

  customizer.addDataSource(async () => new DemoFintechDataSource());

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
