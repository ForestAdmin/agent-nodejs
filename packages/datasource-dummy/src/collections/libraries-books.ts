import {
  DataSource,
  FieldSchema,
  FieldTypes,
  PrimitiveTypes,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import BaseDummyCollection from './base';

export default class LibrariesBooksCollection extends BaseDummyCollection {
  private static schema: Record<string, FieldSchema> = {
    bookId: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
    },
    libraryId: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
    },
    book: {
      type: FieldTypes.ManyToOne,
      foreignCollection: 'books',
      foreignKey: 'bookId',
    },
    library: {
      type: FieldTypes.ManyToOne,
      foreignCollection: 'libraries',
      foreignKey: 'libraryId',
    },
  };

  private static records: RecordData[] = [
    {
      bookId: 1,
      book: {
        id: 1,
        title: 'Beat the dealer',
        publication: new Date().toISOString(),
        authorId: 1,
        author: { id: 1, firstName: 'Edward O.', lastName: 'Thorp' },
      },
      libraryId: 1,
      library: {
        id: 1,
        name: 'Mollat',
      },
    },
    {
      bookId: 2,
      book: {
        id: 2,
        title: 'Foundation',
        publication: new Date().toISOString(),
        authorId: 2,
        author: { id: 2, firstName: 'Isaac', lastName: 'Asimov' },
      },
      libraryId: 1,
      library: {
        id: 1,
        name: 'Mollat',
      },
    },
    {
      bookId: 3,
      book: {
        id: 3,
        title: 'Gomorrah',
        publication: new Date().toISOString(),
        authorId: 3,
        author: { id: 3, firstName: 'Roberto', lastName: 'Saviano' },
      },
      libraryId: 2,
      library: {
        id: 2,
        name: 'Cultura',
      },
    },
  ];

  constructor(datasource: DataSource) {
    super(
      datasource,
      'librariesBooks',
      LibrariesBooksCollection.schema,
      LibrariesBooksCollection.records,
    );
  }
}
