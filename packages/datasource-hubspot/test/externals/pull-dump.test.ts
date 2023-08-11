import { HUBSPOT_COLLECTIONS } from '../../src/constants';
import Cache from '../data/factories/cache';
import Hubspot from '../data/factories/hubspot';

describe('pull dump', () => {
  let hubspot: Hubspot;

  describe('when contacts is created on hubspot', () => {
    beforeEach(async () => {
      hubspot = new Hubspot();
      await Promise.all(
        HUBSPOT_COLLECTIONS.map(async collectionName => {
          await hubspot.deleteAllRecords(collectionName);
        }),
      );
    });

    it('should get all the records and the relations', async () => {
      await hubspot.createContact({ firstname: 'Forest' });
      await hubspot.createCompany({ city: 'Forest' });
      await hubspot.createDeal({ dealname: 'Forest' });
      await hubspot.createTicket({ subject: 'Forest' });
      // await hubspot.createFeedbackSubmission({ name: 'Forest' });
      await hubspot.createLineItem({ name: 'Forest' });
      await hubspot.createProduct({ name: 'Forest' });
      await hubspot.createQuote({ hs_title: 'Forest' });

      const dataSource = await Hubspot.makeDatasource({
        collections: {
          contacts: ['firstname'],
          companies: ['city'],
          deals: ['dealname'],
          tickets: ['subject'],
          feedback_submissions: ['name'],
          line_items: ['name'],
          products: ['name'],
          quotes: ['hs_title'],
        },
      });

      const contacts = await Cache.getAllRecords(dataSource, 'contacts', ['id', 'firstname']);
      const companies = await Cache.getAllRecords(dataSource, 'companies', ['id', 'city']);
      const deals = await Cache.getAllRecords(dataSource, 'deals', ['id', 'dealname']);
      const tickets = await Cache.getAllRecords(dataSource, 'tickets', ['id', 'subject']);
      const feedbackSubmissions = await Cache.getAllRecords(dataSource, 'feedback_submissions', [
        'id',
        'name',
      ]);
      const lineItems = await Cache.getAllRecords(dataSource, 'line_items', ['id', 'name']);
      const products = await Cache.getAllRecords(dataSource, 'products', ['id', 'name']);
      const quotes = await Cache.getAllRecords(dataSource, 'quotes', ['id', 'hs_title']);

      expect(contacts).toEqual([{ firstname: 'Forest', id: expect.any(String) }]);
      expect(companies).toEqual([{ city: 'Forest', id: expect.any(String) }]);
      expect(deals).toEqual([{ dealname: 'Forest', id: expect.any(String) }]);
      expect(tickets).toEqual([{ subject: 'Forest', id: expect.any(String) }]);
      expect(feedbackSubmissions).toEqual([{ name: 'Forest', id: expect.any(String) }]);
      expect(lineItems).toEqual([{ name: 'Forest', id: expect.any(String) }]);
      expect(products).toEqual([{ name: 'Forest', id: expect.any(String) }]);
      expect(quotes).toEqual([{ hs_title: 'Forest', id: expect.any(String) }]);
    }, 15000);
  });
});
