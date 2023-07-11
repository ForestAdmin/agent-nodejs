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

  it('should write the file type for the given collection names', async () => {
    const typingsPath = '/tmp/test_typings.ts';
    const client = makeClient(jest.fn().mockResolvedValue(contactsData));
    await writeCollectionTypesFile(client, ['contacts'], typingsPath);
    const newTypings = fs.readFileSync(typingsPath, 'utf-8');

    expect(newTypings).toEqual(
      fs.readFileSync(path.join(__dirname, 'data/contacts-collection-type.txt'), 'utf-8'),
    );
  });

  describe('when the given collections does not exist', () => {
    it('should display a log message', async () => {
      const typingsPath = '/tmp/test_typings.ts';
      const client = makeClient(jest.fn().mockResolvedValue({ results: [] }));
      const logger = jest.fn();
      await writeCollectionTypesFile(client, ['notExistCollection'], typingsPath, logger);
      expect(logger).toHaveBeenCalledWith('Warn', 'No collection found. Nothing to write.');
    });
  });
});
