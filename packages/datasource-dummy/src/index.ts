import {
  DataSource,
  DataSourceDecorator,
  FieldTypes,
  JointureCollectionDecorator,
} from '@forestadmin/datasource-toolkit';
import DummyDataSource from './datasource';

export default function makeDummyDataSource(): DataSource {
  const dummy = new DummyDataSource();
  const jointures = new DataSourceDecorator(dummy, JointureCollectionDecorator);

  jointures.getCollection('persons').addJointure('books', {
    type: FieldTypes.OneToMany,
    foreignCollection: 'books',
    originKey: 'authorId',
  });

  jointures.getCollection('books').addJointure('author', {
    type: FieldTypes.ManyToOne,
    foreignCollection: 'persons',
    foreignKey: 'authorId',
  });

  jointures.getCollection('books').addJointure('librairies', {
    type: FieldTypes.ManyToMany,
    foreignCollection: 'libraries',
    throughCollection: 'librariesBooks',
    originKey: 'bookId',
    foreignKey: 'libraryId',
    foreignRelation: 'library',
  });

  jointures.getCollection('libraries').addJointure('books', {
    type: FieldTypes.ManyToMany,
    originKey: 'libraryId',
    foreignKey: 'bookId',
    throughCollection: 'librariesBooks',
    foreignCollection: 'books',
    foreignRelation: 'book',
  });

  jointures.getCollection('librariesBooks').addJointure('book', {
    type: FieldTypes.ManyToOne,
    foreignCollection: 'books',
    foreignKey: 'bookId',
  });

  jointures.getCollection('librariesBooks').addJointure('library', {
    type: FieldTypes.ManyToOne,
    foreignCollection: 'libraries',
    foreignKey: 'libraryId',
  });

  return jointures;
}
