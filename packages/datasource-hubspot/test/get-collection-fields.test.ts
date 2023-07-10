import { Client } from '@hubspot/api-client';

import companiesData from './data/companies.json';
import contactsData from './data/contacts.json';
import getCollectionFields from '../src/get-collection-fields';

describe('getCollectionFields', () => {
  const makeClient = (getAllMock: jest.Mock = jest.fn()) => {
    return {
      crm: {
        properties: {
          coreApi: {
            getAll: getAllMock,
          },
        },
      },
    } as unknown as Client;
  };

  it('should return a list of fields for each collection', async () => {
    const getAllMock = jest
      .fn()
      .mockImplementationOnce(() => companiesData)
      .mockImplementationOnce(() => contactsData);
    const client = makeClient(getAllMock);
    const fieldsByCollection = await getCollectionFields(client, ['companies', 'contacts']);
    expect(fieldsByCollection).toEqual({
      companies: expect.any(Array),
      contacts: expect.any(Array),
    });
  });
});
