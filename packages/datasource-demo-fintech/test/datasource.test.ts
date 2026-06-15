import DemoFintechDataSource from '../src/datasource';

describe('DemoFintechDataSource', () => {
  it('should instanciate properly', () => {
    expect(new DemoFintechDataSource()).toBeDefined();
  });

  describe('collections', () => {
    it('should hold the eight fintech collections', () => {
      const dataSource = new DemoFintechDataSource();

      expect(dataSource.collections).toBeArrayOfSize(8);
      expect(dataSource.collections).toEqual([
        expect.objectContaining({ name: 'customers' }),
        expect.objectContaining({ name: 'cards' }),
        expect.objectContaining({ name: 'aml_alerts' }),
        expect.objectContaining({ name: 'kyc_cases' }),
        expect.objectContaining({ name: 'kyc_documents' }),
        expect.objectContaining({ name: 'chargebacks' }),
        expect.objectContaining({ name: 'refund_requests' }),
        expect.objectContaining({ name: 'sar_reports' }),
      ]);
    });
  });
});
