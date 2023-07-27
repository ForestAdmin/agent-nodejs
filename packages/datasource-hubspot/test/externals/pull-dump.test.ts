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
      // ADD FACTORIES TO CREATE RECORDS:
      // createContact,
      // createCompany,
      // createDeal,
      // createTicket
      // createFeedbackSubmission,
      // createLineItem,
      // createProduct,
      // createQuote
      const dataSource = await Hubspot.makeDatasource({
        collections: {
          contacts: ['name'],
          companies: ['name'],
          deals: ['name'],
          tickets: ['name'],
          feedback_submissions: ['name'],
          line_items: ['name'],
          products: ['name'],
          quotes: ['name'],
        },
      });

      const contacts = await Cache.getAllRecords(dataSource, 'contacts', ['id', 'name']);
      const companies = await Cache.getAllRecords(dataSource, 'companies', ['id', 'name']);
      const deals = await Cache.getAllRecords(dataSource, 'deals', ['id', 'name']);
      const tickets = await Cache.getAllRecords(dataSource, 'tickets', ['id', 'name']);
      const feedbackSubmissions = await Cache.getAllRecords(dataSource, 'feedback_submissions', [
        'id',
        'name',
      ]);
      const lineItems = await Cache.getAllRecords(dataSource, 'line_items', ['id', 'name']);
      const products = await Cache.getAllRecords(dataSource, 'products', ['id', 'name']);
      const quotes = await Cache.getAllRecords(dataSource, 'quotes', ['id', 'name']);

      expect(contacts).toEqual([{ name: 'Forest', id: expect.any(String) }]);
      expect(companies).toEqual([{ name: 'Forest', id: expect.any(String) }]);
      expect(deals).toEqual([{ name: 'Forest', id: expect.any(String) }]);
      expect(tickets).toEqual([{ name: 'Forest', id: expect.any(String) }]);
      expect(feedbackSubmissions).toEqual([{ name: 'Forest', id: expect.any(String) }]);
      expect(lineItems).toEqual([{ name: 'Forest', id: expect.any(String) }]);
      expect(products).toEqual([{ name: 'Forest', id: expect.any(String) }]);
      expect(quotes).toEqual([{ name: 'Forest', id: expect.any(String) }]);
    });
  });
});
