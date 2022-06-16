import mongoose, { Schema } from 'mongoose';

import MongooseDatasource from '../src/datasource';

describe('MongooseDatasource', () => {
  it('should give one collection by default', () => {
    mongoose.model('books', new Schema({}));
    const datasource = new MongooseDatasource(mongoose.connection);
    mongoose.deleteModel('books');

    expect(datasource.collections).toMatchObject([{ name: 'books' }]);
  });

  it('should create through collections by default', () => {
    mongoose.model('books', new Schema({ authors: [{ type: 'ObjectId', ref: 'authors' }] }));
    mongoose.model('authors', new Schema({}));

    const datasource = new MongooseDatasource(mongoose.connection);
    mongoose.deleteModel('books');
    mongoose.deleteModel('authors');

    expect(datasource.collections).toMatchObject([
      { name: 'books' },
      { name: 'books_authors' },
      { name: 'authors' },
    ]);
  });

  it('should not create through collection if specified', () => {
    mongoose.model('books', new Schema({ authors: { type: 'ObjectId', ref: 'authors' } }));
    mongoose.model('authors', new Schema({}));

    const datasource = new MongooseDatasource(mongoose.connection, { asModels: { books: [] } });
    mongoose.deleteModel('books');
    mongoose.deleteModel('authors');

    expect(datasource.collections).toMatchObject([{ name: 'books' }, { name: 'authors' }]);
  });

  it('should accept both dots and colons as separator in options', () => {
    mongoose.model('books', new Schema({ author: { firstname: String, lastname: String } }));

    const datasource = new MongooseDatasource(mongoose.connection, {
      asModels: { books: ['author.firstname', 'author:lastname'] },
    });

    mongoose.deleteModel('books');

    expect(datasource.collections).toMatchObject([
      { name: 'books' },
      { name: 'books_author' },
      { name: 'books_author_firstname' },
      { name: 'books_author_lastname' },
    ]);
  });
});
