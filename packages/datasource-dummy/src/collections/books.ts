import {
  DataSource,
  FieldSchema,
  FieldTypes,
  PrimitiveTypes,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import BaseDummyCollection from './base';

export default class BooksCollection extends BaseDummyCollection {
  private static schema: Record<string, FieldSchema> = {
    id: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
    },
    title: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.String,
      defaultValue: 'Le rouge et le noir',
    },
    publication: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Date,
    },
    authorId: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Number,
      defaultValue: 34,
    },
    author: {
      type: FieldTypes.ManyToOne,
      foreignCollection: 'persons',
      foreignKey: 'authorId',
    },
    libraries: {
      type: FieldTypes.ManyToMany,
      foreignKey: 'libraryId',
      throughCollection: 'librariesBooks',
      foreignCollection: 'libraries',
      originRelation: 'book',
      targetRelation: 'library',
      otherField: 'bookId',
    },
  };

  private static records: RecordData[] = [
    {
      id: 1,
      title: 'Beat the dealer',
      publication: new Date().toISOString(),
      authorId: 1,
      author: { id: 1, firstName: 'Edward O.', lastName: 'Thorp' },
    },
    {
      id: 2,
      title: 'Foundation',
      publication: new Date().toISOString(),
      authorId: 2,
      author: { id: 2, firstName: 'Isaac', lastName: 'Asimov' },
    },
    {
      id: 3,
      title: 'Gomorrah',
      publication: new Date().toISOString(),
      authorId: 3,
      author: { id: 3, firstName: 'Roberto', lastName: 'Saviano' },
    },
    {
      id: 4,
      title: 'Misery',
      authorId: 4,
      publication: new Date().toISOString(),
      author: { id: 4, firstName: 'Stephen', lastName: 'King' },
    },
    {
      id: 5,
      title: 'Chistine',
      authorId: 4,
      publication: new Date().toISOString(),
      author: { id: 4, firstName: 'Stephen', lastName: 'King' },
    },
    {
      id: 6,
      title: 'Running Man',
      authorId: 4,
      publication: new Date().toISOString(),
      author: { id: 4, firstName: 'Stephen', lastName: 'King' },
    },
    {
      id: 7,
      title: 'A good one',
      authorId: 3,
      publication: new Date().toISOString(),
      author: { id: 3, firstName: 'Roberto', lastName: 'Saviano' },
    },
  ];

  constructor(datasource: DataSource) {
    super(datasource, 'books', BooksCollection.schema, BooksCollection.records);
  }
}
