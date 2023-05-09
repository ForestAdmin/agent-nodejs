import createDb from './_mock';
import Introspector from '../src/introspection';
import { MongoDb } from '../src/introspection/types';

describe('Introspection > index', () => {
  let db: MongoDb;

  beforeAll(async () => {
    db = createDb({
      publisher: [
        { _id: 'pub1', name: 'Gnome Press', founded: 1948, defunct: 1962, mixed: true },
        { _id: 'pub2', name: 'Hachette', founded: 1826, defunct: null, mixed: null },
        { _id: 'pub2', name: 'Gallimard', founded: 1911, defunct: null, mixed: 'Hi!' },
      ],
      book: [
        {
          _id: 'bk1',
          title: 'Foundation',
          publisher: 'pub1',
          dateOfPublication: new Date('1951-01-01T00:00:00Z'),
          categories: ['sf', 'novel', 'top-sellers'],
          cover: { _bsontype: 'Binary' },
        },
      ],
    });
  });

  test('should work', async () => {
    const result = await Introspector.introspect(db);

    expect(result).toEqual([
      {
        name: 'book',
        analysis: {
          type: 'object',
          nullable: false,
          object: {
            _id: { type: 'string', nullable: false },
            dateOfPublication: { type: 'Date', nullable: false },
            publisher: { type: 'string', referenceTo: 'publisher', nullable: false },
            title: { type: 'string', nullable: false },
            categories: {
              type: 'array',
              nullable: false,
              arrayElement: { type: 'string', nullable: false },
            },
            cover: { type: 'Binary', nullable: false },
          },
        },
      },
      {
        name: 'publisher',
        analysis: {
          type: 'object',
          nullable: false,
          object: {
            _id: { type: 'string', nullable: false },
            defunct: { type: 'number', nullable: true },
            founded: { type: 'number', nullable: false },
            name: { type: 'string', nullable: false },
            mixed: { type: 'Mixed', nullable: true },
          },
        },
      },
    ]);
  });
});
