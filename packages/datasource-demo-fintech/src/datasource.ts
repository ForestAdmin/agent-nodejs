import { BaseDataSource } from '@forestadmin/datasource-toolkit';

import AmlAlertsCollection from './collections/aml-alerts';
import CardsCollection from './collections/cards';
import ChargebacksCollection from './collections/chargebacks';
import CustomersCollection from './collections/customers';
import KycCasesCollection from './collections/kyc-cases';
import KycDocumentsCollection from './collections/kyc-documents';
import RefundRequestsCollection from './collections/refund-requests';
import SarReportsCollection from './collections/sar-reports';

export default class DemoFintechDataSource extends BaseDataSource {
  constructor() {
    super();

    this.addCollection(new CustomersCollection(this));
    this.addCollection(new CardsCollection(this));
    this.addCollection(new AmlAlertsCollection(this));
    this.addCollection(new KycCasesCollection(this));
    this.addCollection(new KycDocumentsCollection(this));
    this.addCollection(new ChargebacksCollection(this));
    this.addCollection(new RefundRequestsCollection(this));
    this.addCollection(new SarReportsCollection(this));
  }
}
