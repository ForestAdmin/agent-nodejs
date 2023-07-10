import { Client } from '@hubspot/api-client';

import companiesData from './companies.json';
import contactsData from './contacts.json';
import getSchema from '../src/schema';

describe('getSchema', () => {
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

  it('should always return an id field', async () => {
    const client = makeClient(jest.fn().mockResolvedValue(companiesData));
    const [collectionSchema] = await getSchema(client, { companies: ['about_us'] });
    expect(collectionSchema.fields.id).toEqual({
      isPrimaryKey: true,
      type: 'String',
      isReadOnly: true,
    });
  });

  describe('different field types', () => {
    test.each([
      // type, expectedAttributes, field, dataSample
      ['string', { type: 'String' }, 'about_us', companiesData],
      ['datetime', { type: 'Date' }, 'closedate_timestamp_earliest_value_a2a17e6e', companiesData],
      ['number', { type: 'Number' }, 'facebookfans', companiesData],
      [
        'enumeration',
        {
          type: 'Enum',
          enumValues: [
            'ORGANIC_SEARCH',
            'PAID_SEARCH',
            'EMAIL_MARKETING',
            'SOCIAL_MEDIA',
            'REFERRALS',
            'OTHER_CAMPAIGNS',
            'DIRECT_TRAFFIC',
            'OFFLINE',
            'PAID_SOCIAL',
          ],
        },
        'hs_analytics_latest_source',
        companiesData,
      ],
      ['boolean', { type: 'Boolean' }, 'hs_is_target_account', companiesData],
      [
        'phone_number',
        { type: 'String' },
        'hs_searchable_calculated_international_mobile_number',
        contactsData,
      ],
    ])(
      'should return the expected attributes for %s type',
      async (type, expectedAttributes, field, data) => {
        const client = makeClient(jest.fn().mockResolvedValue(data));
        const [collectionSchema] = await getSchema(client, {
          companies: [field],
        });
        expect(collectionSchema.fields[field]).toEqual({
          isPrimaryKey: false,
          isReadOnly: true,
          ...expectedAttributes,
        });
      },
    );
  });
});
