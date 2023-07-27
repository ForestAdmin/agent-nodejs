import { sleep } from './utils';
import Cache from '../data/factories/cache';
import Hubspot from '../data/factories/hubspot';

describe('pull delta', () => {
  let hubspot: Hubspot;

  describe('when contacts is created on hubspot', () => {
    beforeEach(async () => {
      hubspot = new Hubspot();
      await hubspot.deleteAllRecords('contacts');
      await hubspot.deleteAllRecords('companies');
    });

    it('should get all the contacts', async () => {
      await hubspot.createContact({ email: 'forest@gmail.com' });
      await hubspot.createContact({ email: 'forestadmin@gmail.com' });

      const dataSource = await Hubspot.makeDatasource({ collections: { contacts: ['email'] } });

      const records = await Cache.getAllRecords(dataSource, 'contacts', ['id', 'email']);
      expect(records).toEqual([
        { email: 'forest@gmail.com', id: expect.any(String) },
        { email: 'forestadmin@gmail.com', id: expect.any(String) },
      ]);
    });

    describe('when contacts has relations with companies', () => {
      it('should get all the contacts ans its relations', async () => {
        const contact = await hubspot.createContact({ email: 'forest@gmail.com' });
        const company = await hubspot.createCompany({ name: 'Forest' });
        await hubspot.createRelationship(
          'companies',
          Number(company.id),
          'contacts',
          Number(contact.id),
        );

        const dataSource = await Hubspot.makeDatasource({
          collections: { contacts: ['email'], companies: ['name'] },
        });

        const contactRecords = await Cache.getAllRecords(dataSource, 'contacts', ['id', 'email']);
        const companyRecords = await Cache.getAllRecords(dataSource, 'companies', ['id', 'name']);
        const contactCompanyRecords = await Cache.getAllRecords(
          dataSource,
          'companies___contacts',
          ['contacts_id', 'companies_id'],
        );

        expect(contactRecords).toEqual([{ email: 'forest@gmail.com', id: expect.any(String) }]);
        expect(companyRecords).toEqual([{ name: 'Forest', id: expect.any(String) }]);
        expect(contactCompanyRecords).toEqual([
          { contacts_id: contact.id, companies_id: company.id },
        ]);
      });
    });

    describe('when contacts is updated on hubspot', () => {
      it('should update the record', async () => {
        const contact = await hubspot.createContact({ email: 'forest@gmail.com' });
        const dataSource = await Hubspot.makeDatasource({ collections: { contacts: ['email'] } });

        const contactRecords = await Cache.getAllRecords(dataSource, 'contacts', ['id', 'email']);
        expect(contactRecords).toEqual([{ email: 'forest@gmail.com', id: expect.any(String) }]);

        await hubspot.updateRecord('contacts', contact.id, {
          email: 'updatedForest@gmail.com',
        });
        await sleep(10000); // depends on the hubspot delay, the test is flaky

        const updatedContactRecords = await Cache.getAllRecords(dataSource, 'contacts', [
          'id',
          'email',
        ]);

        expect(updatedContactRecords).toEqual([
          { email: 'updatedforest@gmail.com', id: expect.any(String) },
        ]);
      }, 20000);
    });
  });
});
