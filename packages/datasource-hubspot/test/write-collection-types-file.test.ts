import { Client } from '@hubspot/api-client';
import fs from 'fs';
import path from 'path';

import contactsData from './data/contacts.json';
import writeCollectionTypesFile from '../src/write-collection-types-file';

describe('generateTypes', () => {
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

  it('should write the allowed values for the contact collection', async () => {
    const typingsPath = '/tmp/test_typings.ts';
    const client = makeClient(jest.fn().mockResolvedValue(contactsData));
    await writeCollectionTypesFile(client, typingsPath);
    const newTypings = fs.readFileSync(typingsPath, 'utf-8');

    expect(newTypings).toEqual(
      fs.readFileSync(path.join(__dirname, 'data/contacts-collection-type.txt'), 'utf-8'),
    );
  });
});
