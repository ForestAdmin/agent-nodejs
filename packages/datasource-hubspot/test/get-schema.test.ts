import { Client } from '@hubspot/api-client';

import companiesData from './data/companies.json';
import contactsData from './data/contacts.json';
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
    describe('specific cases', () => {
      describe('when the field type is not supported', () => {
        it('should throw an error', async () => {
          const data = { results: [{ name: 'unsupported', type: 'unsupported' }] };
          const client = makeClient(jest.fn().mockResolvedValue(data));
          await expect(() => getSchema(client, { companies: ['unsupported'] })).rejects.toThrow(
            'Property "unsupported" has unsupported type unsupported',
          );
        });
      });

      describe('when the field is an enum and options is empty', () => {
        it('should not import the field', async () => {
          const data = {
            results: [{ name: 'emptyEnumOptions', type: 'enumeration', options: [] }],
          };
          const client = makeClient(jest.fn().mockResolvedValue(data));
          const [collectionSchema] = await getSchema(client, { companies: ['emptyEnumOptions'] });
          expect(collectionSchema.fields.emptyEnumOptions).toBeUndefined();
        });
      });
    });

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
