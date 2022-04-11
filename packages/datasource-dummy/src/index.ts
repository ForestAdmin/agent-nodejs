import {
  DataSource,
  DataSourceDecorator,
  RelationCollectionDecorator,
} from '@forestadmin/datasource-toolkit';
import DummyDataSource from './datasource';

export default function makeDummyDataSource(): DataSource {
  const dummy = new DummyDataSource();
  const relations = new DataSourceDecorator(dummy, RelationCollectionDecorator);

  relations.getCollection('persons').addRelation('books', {
    type: 'OneToMany',
    foreignCollection: 'books',
    originKey: 'authorId',
  });

  relations.getCollection('books').addRelation('author', {
    type: 'ManyToOne',
    foreignCollection: 'persons',
    foreignKey: 'authorId',
  });

  relations.getCollection('books').addRelation('librairies', {
    type: 'ManyToMany',
    foreignCollection: 'libraries',
    throughCollection: 'librariesBooks',
    originKey: 'bookId',
    foreignKey: 'libraryId',
    foreignRelation: 'library',
  });

  relations.getCollection('libraries').addRelation('books', {
    type: 'ManyToMany',
    originKey: 'libraryId',
    foreignKey: 'bookId',
    throughCollection: 'librariesBooks',
    foreignCollection: 'books',
    foreignRelation: 'book',
  });

  relations.getCollection('librariesBooks').addRelation('book', {
    type: 'ManyToOne',
    foreignCollection: 'books',
    foreignKey: 'bookId',
  });

  relations.getCollection('librariesBooks').addRelation('library', {
    type: 'ManyToOne',
    foreignCollection: 'libraries',
    foreignKey: 'libraryId',
  });

  return relations;
}
