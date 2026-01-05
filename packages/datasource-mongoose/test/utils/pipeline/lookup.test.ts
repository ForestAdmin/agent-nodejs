import type { Stack } from '../../../src/types';
import type { Model } from 'mongoose';

import { Projection } from '@forestadmin/datasource-toolkit';
import mongoose, { Schema } from 'mongoose';

import LookupGenerator from '../../../src/utils/pipeline/lookup';

describe('LookupGenerator', () => {
  let books: Model<unknown>;

  beforeAll(() => {
    mongoose.model(
      'countries',
      new Schema({
        name: String,
        meta: { population: Number, capital: String },
      }),
    );
    mongoose.model(
      'editors',
      new Schema({
        firstname: String,
        lastname: String,
        address: {
          city: String,
          street: String,
          code: String,
          meta: {
            length: Number,
          },
        },
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
      const generator = () => LookupGenerator.lookup(books, stack, projection, {});

      expect(generator).toThrow("Unexpected relation: 'myAuthor'");
    });

    it('should do nothing with projection that only contains columns', () => {
      const projection = new Projection('title');
      const pipeline = LookupGenerator.lookup(books, stack, projection, {});

      expect(pipeline).toStrictEqual([]);
    });

    it('should do nothing with projection that only contains fake relations', () => {
      const projection = new Projection('author:firstname');
      const pipeline = LookupGenerator.lookup(books, stack, projection, {});

      expect(pipeline).toStrictEqual([]);
    });

    it('should load the editor (relation)', () => {
      const projection = new Projection('editor__manyToOne:firstname');
      const pipeline = LookupGenerator.lookup(books, stack, projection, {});

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

    it('should load the editor (relation) with nested fields', () => {
      const projection = new Projection('editor__manyToOne:address@@@city');
      const pipeline = LookupGenerator.lookup(books, stack, projection, {});

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
          $addFields: {
            'editor__manyToOne.address@@@city': '$editor__manyToOne.address.city',
          },
        },
      ]);
    });

    describe('include', () => {
      it('should return the nested field if the parent is included', () => {
        const projection = new Projection('editor__manyToOne:address@@@city');
        const pipeline = LookupGenerator.lookup(books, stack, projection, {
          include: new Set(['editor__manyToOne']),
        });

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
            $addFields: {
              'editor__manyToOne.address@@@city': '$editor__manyToOne.address.city',
            },
          },
        ]);
      });

      it('should not add the nested field ifthe parent is not included', () => {
        const projection = new Projection('editor__manyToOne:address@@@city');
        const pipeline = LookupGenerator.lookup(books, stack, projection, {
          include: new Set([]),
        });

        expect(pipeline).toStrictEqual([]);
      });
    });

    describe('exclude', () => {
      it('should not add the nested field if the parent is excluded', () => {
        const projection = new Projection('editor__manyToOne:address@@@city');
        const pipeline = LookupGenerator.lookup(books, stack, projection, {
          exclude: new Set(['editor__manyToOne']),
        });

        expect(pipeline).toStrictEqual([]);
      });

      it('should return the nested field if the parent is not excluded', () => {
        const projection = new Projection('editor__manyToOne:address@@@city');
        const pipeline = LookupGenerator.lookup(books, stack, projection, {
          exclude: new Set([]),
        });

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
            $addFields: {
              'editor__manyToOne.address@@@city': '$editor__manyToOne.address.city',
            },
          },
        ]);
      });
    });

    it('should load the editor (relation) with doubly nested fields', () => {
      const projection = new Projection('editor__manyToOne:address@@@meta@@@length');
      const pipeline = LookupGenerator.lookup(books, stack, projection, {});

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
          $addFields: {
            'editor__manyToOne.address@@@meta@@@length': '$editor__manyToOne.address.meta.length',
          },
        },
      ]);
    });

    it('should load the editor country capital (double relation with nested field)', () => {
      const projection = new Projection('editor__manyToOne:country__manyToOne:meta@@@capital');
      const pipeline = LookupGenerator.lookup(books, stack, projection, {});

      expect(pipeline).toStrictEqual([
        {
          $lookup: {
            from: 'editors',
            localField: 'editor',
            foreignField: '_id',
            as: 'editor__manyToOne',
          },
        },
        {
          $unwind: {
            path: '$editor__manyToOne',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'countries',
            localField: 'editor__manyToOne.country',
            foreignField: '_id',
            as: 'editor__manyToOne.country__manyToOne',
          },
        },
        {
          $unwind: {
            path: '$editor__manyToOne.country__manyToOne',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            'country__manyToOne.meta@@@capital': '$country__manyToOne.meta.capital',
          },
        },
        {
          $addFields: {
            'editor__manyToOne.country__manyToOne.meta@@@capital':
              '$editor__manyToOne.country__manyToOne.meta.capital',
          },
        },
      ]);
    });

    it('should load the editor country meta length (double relation with doubly nested field)', () => {
      const projection = new Projection(
        'editor__manyToOne:country__manyToOne:meta@@@meta@@@length',
      );
      const pipeline = LookupGenerator.lookup(books, stack, projection, {});

      expect(pipeline).toStrictEqual([
        {
          $lookup: {
            from: 'editors',
            localField: 'editor',
            foreignField: '_id',
            as: 'editor__manyToOne',
          },
        },
        {
          $unwind: {
            path: '$editor__manyToOne',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'countries',
            localField: 'editor__manyToOne.country',
            foreignField: '_id',
            as: 'editor__manyToOne.country__manyToOne',
          },
        },
        {
          $unwind: {
            path: '$editor__manyToOne.country__manyToOne',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            'country__manyToOne.meta@@@meta@@@length': '$country__manyToOne.meta.meta.length',
          },
        },
        {
          $addFields: {
            'editor__manyToOne.country__manyToOne.meta@@@meta@@@length':
              '$editor__manyToOne.country__manyToOne.meta.meta.length',
          },
        },
      ]);
    });

    it('should load the author country (relation within fake relation)', () => {
      const projection = new Projection('author:country__manyToOne:name');
      const pipeline = LookupGenerator.lookup(books, stack, projection, {});

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
      const pipeline = LookupGenerator.lookup(books, stack, projection, {});

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
      const pipeline = LookupGenerator.lookup(books, stack, projection, {});

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
      const pipeline = LookupGenerator.lookup(books, stack, projection, {});

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
