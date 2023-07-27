import Cache from '../data/factories/cache';
import Hubspot from '../data/factories/hubspot';

describe('pull dump', () => {
  let hubspot: Hubspot;
  describe('when contacts is given', () => {
    beforeEach(async () => {
      hubspot = new Hubspot();
      await hubspot.deleteAllRecords('contacts');
    });

    it('should get all the contacts', async () => {
      await hubspot.createRecord('contacts', { name: 'forest' });
      await hubspot.createRecord('contacts', { name: 'forest2' });

      const dataSource = await Hubspot.makeDatasource({ collections: { contacts: ['name'] } });

      const records = await Cache.getAllRecords(dataSource, 'contacts');
      expect(records).toHaveLength(2);
    });
  });
});
