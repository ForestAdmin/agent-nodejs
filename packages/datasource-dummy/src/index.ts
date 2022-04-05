import {
  DataSource,
  DataSourceDecorator,
  FieldTypes,
  RelationCollectionDecorator,
} from '@forestadmin/datasource-toolkit';
import DummyDataSource from './datasource';

export default function makeDummyDataSource(): DataSource {
  const dummy = new DummyDataSource();
  const relations = new DataSourceDecorator(dummy, RelationCollectionDecorator);

  relations.getCollection('persons').addRelation('books', {
    type: FieldTypes.OneToMany,
    foreignCollection: 'books',
    originKey: 'authorId',
  });

  relations.getCollection('books').addRelation('author', {
    type: FieldTypes.ManyToOne,
    foreignCollection: 'persons',
    foreignKey: 'authorId',
  });

  relations.getCollection('books').addRelation('librairies', {
    type: FieldTypes.ManyToMany,
    foreignCollection: 'libraries',
    throughCollection: 'librariesBooks',
    originKey: 'bookId',
    foreignKey: 'libraryId',
    foreignRelation: 'library',
  });

  relations.getCollection('libraries').addRelation('books', {
    type: FieldTypes.ManyToMany,
    originKey: 'libraryId',
    foreignKey: 'bookId',
    throughCollection: 'librariesBooks',
    foreignCollection: 'books',
    foreignRelation: 'book',
  });

  relations.getCollection('librariesBooks').addRelation('book', {
    type: FieldTypes.ManyToOne,
    foreignCollection: 'books',
    foreignKey: 'bookId',
  });

  relations.getCollection('librariesBooks').addRelation('library', {
    type: FieldTypes.ManyToOne,
    foreignCollection: 'libraries',
    foreignKey: 'libraryId',
  });

  return relations;
}
