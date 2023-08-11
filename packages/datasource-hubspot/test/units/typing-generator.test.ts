import fs from 'fs';
import path from 'path';

import generateTypesIfChange from '../../src/typing-generator';
import contactsData from '../data/contacts.json';

describe('generateTypesIfChange', () => {
  const makeLogger = () => jest.fn();

  it('should write the file type for the given collection names', async () => {
    const typingsPath = '/tmp/test_typings.ts';
    await generateTypesIfChange({ contacts: contactsData.results }, typingsPath, makeLogger);
    const newTypings = fs.readFileSync(typingsPath, 'utf-8');

    expect(newTypings).toEqual(
      fs.readFileSync(path.join(__dirname, 'data/contacts-collection-type.txt'), 'utf-8'),
    );
  });
});
