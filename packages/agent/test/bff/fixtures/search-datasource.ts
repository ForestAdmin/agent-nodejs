import type { FieldSchema, RecordData } from '@forestadmin/datasource-toolkit';

import { BaseDataSource } from '@forestadmin/datasource-toolkit';

import InMemoryCollection from './in-memory-collection';

const AUTHORS: RecordData[] = [
  { id: 1, name: 'Isaac Asimov' },
  { id: 2, name: 'Ursula Le Guin' },
];

// No title contains "asimov", so a search for it returns nothing unless it reaches the author
// relation — which is what tells searchExtended apart from a plain search.
const BOOKS: RecordData[] = [
  { id: 1, title: 'Foundation', authorId: 1 },
  { id: 2, title: 'I, Robot', authorId: 1 },
  { id: 3, title: 'The Dispossessed', authorId: 2 },
];

// Its label carries the same term as a book title, so a rejection asserted on this collection
// cannot pass by accident on a collection that has nothing to match.
const LEDGERS: RecordData[] = [{ id: 1, label: 'Foundation ledger' }];

const NUMBER_PK: FieldSchema = { type: 'Column', columnType: 'Number', isPrimaryKey: true };
const STRING_COLUMN: FieldSchema = { type: 'Column', columnType: 'String' };

export default class SearchDataSource extends BaseDataSource {
  constructor() {
    super();

    this.addCollection(
      new InMemoryCollection(this, 'authors', { id: NUMBER_PK, name: STRING_COLUMN }, AUTHORS),
    );

    this.addCollection(
      new InMemoryCollection(
        this,
        'books',
        {
          id: NUMBER_PK,
          title: STRING_COLUMN,
          authorId: { type: 'Column', columnType: 'Number' },
        },
        BOOKS,
      ),
    );

    this.addCollection(
      new InMemoryCollection(this, 'ledgers', { id: NUMBER_PK, label: STRING_COLUMN }, LEDGERS),
    );
  }
}
