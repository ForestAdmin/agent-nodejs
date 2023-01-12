import { Projection } from '@forestadmin/datasource-toolkit';
import mongoose, { Model, Schema } from 'mongoose';

import { Stack } from '../../../src/types';
import LookupGenerator from '../../../src/utils/pipeline/lookup';

describe('LookupGenerator', () => {
  let books: Model<unknown>;

  beforeAll(() => {
    mongoose.model('countries', new Schema({ name: String }));
    mongoose.model(
      'editors',
      new Schema({
        firstname: String,
        lastname: String,
        country: { type: 'ObjectId', ref: 'countries' },
      }),
    );

    books = mongoose.model<unknown>(
      'books',
      new Schema({
        title: String,
        editor: { type: 'ObjectId', ref: 'editors' },
        author: {
          firstname: String,
          lastname: String,
          country: { type: 'ObjectId', ref: 'countries' },
        },
      }),
    );
  });

  afterAll(() => {
    mongoose.deleteModel('books');
    mongoose.deleteModel('countries');
    mongoose.deleteModel('editors');
  });

  describe('with the root collection', () => {
    const stack: Stack = [{ prefix: null, asFields: [], asModels: [] }];

    it('should crash when non-existent relations are asked for', () => {
      const projection = new Projection('myAuthor:firstname');
      const generator = () => LookupGenerator.lookup(books, stack, projection);

      expect(generator).toThrow("Unexpected relation: 'myAuthor'");
    });

    it('should do nothing with projection that only contains columns', () => {
      const projection = new Projection('title');
      const pipeline = LookupGenerator.lookup(books, stack, projection);

      expect(pipeline).toStrictEqual([]);
    });

    it('should do nothing with projection that only contains fake relations', () => {
      const projection = new Projection('author:firstname');
      const pipeline = LookupGenerator.lookup(books, stack, projection);

      expect(pipeline).toStrictEqual([]);
    });

    it('should load the editor (relation)', () => {
      const projection = new Projection('editor__manyToOne:firstname');
      const pipeline = LookupGenerator.lookup(books, stack, projection);

      expect(pipeline).toStrictEqual([
        {
          $lookup: {
            as: 'editor__manyToOne',
            foreignField: '_id',
            from: 'editors',
            localField: 'editor',
          },
        },
        { $unwind: { path: '$editor__manyToOne', preserveNullAndEmptyArrays: true } },
      ]);
    });

    it('should load the author country (relation within fake relation)', () => {
      const projection = new Projection('author:country__manyToOne:name');
      const pipeline = LookupGenerator.lookup(books, stack, projection);

      expect(pipeline).toStrictEqual([
        {
          $lookup: {
            as: 'author.country__manyToOne',
            foreignField: '_id',
            from: 'countries',
            localField: 'author.country',
          },
        },
        {
          $unwind: {
            path: '$author.country__manyToOne',
            preserveNullAndEmptyArrays: true,
          },
        },
      ]);
    });

    it('should load the editor country (nested relation)', () => {
      const projection = new Projection('editor__manyToOne:country__manyToOne:name');
      const pipeline = LookupGenerator.lookup(books, stack, projection);

      expect(pipeline).toStrictEqual([
        {
          $lookup: {
            as: 'editor__manyToOne',
            foreignField: '_id',
            from: 'editors',
            localField: 'editor',
          },
        },
        { $unwind: { path: '$editor__manyToOne', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            as: 'editor__manyToOne.country__manyToOne',
            foreignField: '_id',
            from: 'countries',
            localField: 'editor__manyToOne.country',
          },
        },
        {
          $unwind: {
            path: '$editor__manyToOne.country__manyToOne',
            preserveNullAndEmptyArrays: true,
          },
        },
      ]);
    });
  });

  describe('with a reparented collection', () => {
    const stack: Stack = [
      { prefix: null, asFields: [], asModels: ['author'] },
      { prefix: 'author', asFields: [], asModels: [] },
    ];

    it('should load the author country (relation)', () => {
      const projection = new Projection('country__manyToOne:firstname');
      const pipeline = LookupGenerator.lookup(books, stack, projection);

      expect(pipeline).toStrictEqual([
        {
          $lookup: {
            as: 'country__manyToOne',
            foreignField: '_id',
            from: 'countries',
            localField: 'country',
          },
        },
        { $unwind: { path: '$country__manyToOne', preserveNullAndEmptyArrays: true } },
      ]);
    });

    it('should load the editor (relation within fake relation)', () => {
      const projection = new Projection('parent:editor__manyToOne:firstname');
      const pipeline = LookupGenerator.lookup(books, stack, projection);

      expect(pipeline).toStrictEqual([
        {
          $lookup: {
            as: 'parent.editor__manyToOne',
            foreignField: '_id',
            from: 'editors',
            localField: 'parent.editor',
          },
        },
        { $unwind: { path: '$parent.editor__manyToOne', preserveNullAndEmptyArrays: true } },
      ]);
    });
  });
});
