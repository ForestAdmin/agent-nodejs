import Cache from '../data/factories/cache';
import Hubspot from '../data/factories/hubspot';

describe('pull dump', () => {
  let hubspot: Hubspot;

  describe('when contacts is created on hubspot', () => {
    beforeEach(async () => {
      hubspot = new Hubspot();
      await hubspot.deleteAllRecords('contacts');
    });

    it('should get all the contacts', async () => {
      await hubspot.createRecord('contacts', { email: 'forest@gmail.com' });
      await hubspot.createRecord('contacts', { email: 'forestadmin@gmail.com' });

      const dataSource = await Hubspot.makeDatasource({ collections: { contacts: ['email'] } });

      const records = await Cache.getAllRecords(dataSource, 'contacts', ['id', 'email']);
      expect(records).toHaveLength(2);
      expect(records).toEqual([
        { email: 'forest@gmail.com', id: expect.any(String) },
        { email: 'forestadmin@gmail.com', id: expect.any(String) },
      ]);
    });
  });
});
