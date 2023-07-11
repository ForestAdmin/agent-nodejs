import fs from 'fs';
import path from 'path';

import contactsData from './data/contacts.json';
import writeCollectionsTypeFileIfChange from '../src/write-collections-type-file';

describe('generateTypes', () => {
  const makeLogger = () => jest.fn();

  it('should write the file type for the given collection names', async () => {
    const typingsPath = '/tmp/test_typings.ts';
    await writeCollectionsTypeFileIfChange(
      { contacts: contactsData.results },
      typingsPath,
      makeLogger,
    );
    const newTypings = fs.readFileSync(typingsPath, 'utf-8');

    expect(newTypings).toEqual(
      fs.readFileSync(path.join(__dirname, 'data/contacts-collection-type.txt'), 'utf-8'),
    );
  });
});
