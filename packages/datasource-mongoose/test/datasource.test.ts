import mongoose, { Schema } from 'mongoose';

import * as CollectionModule from '../src/collection';
import MongooseDatasource from '../src/datasource';

describe('MongooseDatasource', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    // Spy on MongooseCollection constructor
    const MongooseCollection = CollectionModule.default;
    spy = jest
      .spyOn(CollectionModule, 'default')
      .mockImplementation((...args) => new MongooseCollection(...args));
  });

  afterEach(() => {
    spy.mockRestore();
  });

  describe('with simple schemas', () => {
    it('should give one collection by default', () => {
      mongoose.model('books', new Schema({}));
      const datasource = new MongooseDatasource(mongoose.connection);

      expect(datasource.collections).toMatchObject([{ name: 'books' }]);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(datasource, mongoose.model('books'), [
        { prefix: null, asFields: [], asModels: [] },
      ]);

      mongoose.deleteModel('books');
    });

    it('should create through collections by default', () => {
      mongoose.model('books', new Schema({ authors: [{ type: 'ObjectId', ref: 'authors' }] }));
      mongoose.model('authors', new Schema({}));

      const datasource = new MongooseDatasource(mongoose.connection);

      expect(datasource.collections).toMatchObject([
        { name: 'books' },
        { name: 'books_authors' },
        { name: 'authors' },
      ]);

      expect(spy).toHaveBeenCalledTimes(3);
      expect(spy).toHaveBeenCalledWith(datasource, mongoose.model('books'), [
        { prefix: null, asFields: [], asModels: ['authors'] },
      ]);
      expect(spy).toHaveBeenCalledWith(datasource, mongoose.model('books'), [
        { prefix: null, asFields: [], asModels: ['authors'] },
        { prefix: 'authors', asFields: [], asModels: [] },
      ]);
      expect(spy).toHaveBeenCalledWith(datasource, mongoose.model('authors'), [
        { prefix: null, asFields: [], asModels: [] },
      ]);

      mongoose.deleteModel('books');
      mongoose.deleteModel('authors');
    });

    it('should not create through collection if specified', () => {
      mongoose.model('books', new Schema({ authors: { type: 'ObjectId', ref: 'authors' } }));
      mongoose.model('authors', new Schema({}));

      const datasource = new MongooseDatasource(mongoose.connection, { asModels: { books: [] } });

      expect(datasource.collections).toMatchObject([{ name: 'books' }, { name: 'authors' }]);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(datasource, mongoose.model('books'), [
        { prefix: null, asFields: [], asModels: [] },
      ]);
      expect(spy).toHaveBeenCalledWith(datasource, mongoose.model('authors'), [
        { prefix: null, asFields: [], asModels: [] },
      ]);

      mongoose.deleteModel('books');
      mongoose.deleteModel('authors');
    });

    it('should accept both dots and colons as separator in options', () => {
      mongoose.model('books', new Schema({ author: { firstname: String, lastname: String } }));

      const datasource = new MongooseDatasource(mongoose.connection, {
        flattenMode: 'manual',
        flattenOptions: {
          books: { asModels: ['author.firstname', 'author:lastname'] },
        },
      });
      expect(spy).toHaveBeenCalledTimes(3);
      expect(spy).toHaveBeenCalledWith(datasource, mongoose.model('books'), [
        { prefix: null, asFields: [], asModels: ['author.firstname', 'author.lastname'] },
      ]);
      expect(spy).toHaveBeenCalledWith(datasource, mongoose.model('books'), [
        { prefix: null, asFields: [], asModels: ['author.firstname', 'author.lastname'] },
        { prefix: 'author.lastname', asFields: [], asModels: [] },
      ]);
      expect(spy).toHaveBeenCalledWith(datasource, mongoose.model('books'), [
        { prefix: null, asFields: [], asModels: ['author.firstname', 'author.lastname'] },
        { prefix: 'author.firstname', asFields: [], asModels: [] },
      ]);
      expect(datasource.collections).toMatchObject([
        { name: 'books' },
        { name: 'books_author_firstname' },
        { name: 'books_author_lastname' },
      ]);

      mongoose.deleteModel('books');
    });
  });

  describe('with schema that contains references to unknown model', () => {
    beforeEach(() => {
      mongoose.model(
        'aModel',
        new Schema({
          id: Number,
          ref: { type: Schema.Types.ObjectId, ref: 'missingModel' },
        }),
      );
    });

    afterEach(() => {
      mongoose.deleteModel('aModel');
    });

    test('should crash', async () => {
      expect(() => new MongooseDatasource(mongoose.connection)).toThrow(
        `Collection 'missingModel' not found.`,
      );
    });
  });

  describe('with deeply nested schemas', () => {
    beforeEach(() => {
      mongoose.model(
        'aModel',
        new Schema({
          id: Number,
          name: String,
          contactDetails: {
            email: String,
            phone: { home: String, mobile: String },
            referenceList: [{ type: Schema.Types.ObjectId, ref: 'aModel' }],
          },
          nested: {
            referenceList: [{ type: Schema.Types.ObjectId, ref: 'aModel' }],
            objectList: [{ id: Number, name: String, contactDetails: { email: String } }],
          },
        }),
      );
    });

    afterEach(() => {
      mongoose.deleteModel('aModel');
    });

    test('should work with no flattener', async () => {
      void new MongooseDatasource(mongoose.connection);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.anything(), [
        { prefix: null, asFields: [], asModels: [] },
      ]);
    });

    test('should work with nested asModels', async () => {
      void new MongooseDatasource(mongoose.connection, {
        asModels: { aModel: ['contactDetails', 'contactDetails.phone'] },
      });

      expect(spy).toHaveBeenCalledTimes(3);
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.anything(), [
        { prefix: null, asFields: [], asModels: ['contactDetails'] },
      ]);
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.anything(), [
        { prefix: null, asFields: [], asModels: ['contactDetails'] },
        { prefix: 'contactDetails', asFields: [], asModels: ['phone'] },
      ]);
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.anything(), [
        { prefix: null, asFields: [], asModels: ['contactDetails'] },
        { prefix: 'contactDetails', asFields: [], asModels: ['phone'] },
        { prefix: 'contactDetails.phone', asFields: [], asModels: [] },
      ]);
    });

    test('should work with flatten fields', async () => {
      void new MongooseDatasource(mongoose.connection, {
        flattenMode: 'manual',
        flattenOptions: { aModel: { asFields: ['contactDetails'] } },
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.anything(), [
        {
          prefix: null,
          asFields: [
            'contactDetails.email',
            'contactDetails.phone.home',
            'contactDetails.phone.mobile',
            'contactDetails.referenceList',
          ],
          asModels: [],
        },
      ]);
    });

    test('should work with flatten fields and level', async () => {
      void new MongooseDatasource(mongoose.connection, {
        flattenMode: 'manual',
        flattenOptions: { aModel: { asFields: [{ field: 'contactDetails', level: 1 }] } },
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.anything(), [
        {
          prefix: null,
          asFields: [
            'contactDetails.email',
            'contactDetails.phone',
            'contactDetails.referenceList',
          ],
          asModels: [],
        },
      ]);
    });

    test('should work when using both models and fields', async () => {
      void new MongooseDatasource(mongoose.connection, {
        flattenMode: 'manual',
        flattenOptions: {
          aModel: {
            asFields: ['contactDetails.phone.home', 'contactDetails.phone.mobile'],
            asModels: ['contactDetails'],
          },
        },
      });

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.anything(), [
        { prefix: null, asFields: [], asModels: ['contactDetails'] },
      ]);
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.anything(), [
        { prefix: null, asFields: [], asModels: ['contactDetails'] },
        { prefix: 'contactDetails', asFields: ['phone.home', 'phone.mobile'], asModels: [] },
      ]);
    });

    test('should work when flattening objects within submodels', async () => {
      void new MongooseDatasource(mongoose.connection, {
        flattenMode: 'manual',
        flattenOptions: {
          aModel: {
            asFields: ['nested.objectList.contactDetails'],
            asModels: ['nested.objectList'],
          },
        },
      });

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.anything(), [
        { prefix: null, asFields: [], asModels: ['nested.objectList'] },
      ]);
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.anything(), [
        { prefix: null, asFields: [], asModels: ['nested.objectList'] },
        // The .email is there because fields are expanded (and it's the only field in the object)
        { prefix: 'nested.objectList', asFields: ['contactDetails.email'], asModels: [] },
      ]);
    });

    test('should throw when referencing invalid field', async () => {
      const fn = () =>
        new MongooseDatasource(mongoose.connection, {
          flattenMode: 'manual',
          flattenOptions: { aModel: { asFields: ['idontexist'] } },
        });

      expect(fn).toThrow(`Field 'idontexist' not found.`);
    });

    test('should throw when crossing array boundary with asFields', async () => {
      const fn = () =>
        new MongooseDatasource(mongoose.connection, {
          flattenMode: 'manual',
          flattenOptions: { aModel: { asFields: ['nested.objectList.id'] } },
        });

      expect(fn).toThrow(
        'Either add all intermediary arrays to asModels, or remove it from asFields.',
      );
    });

    test('should throw when crossing array boundary with asModels', async () => {
      const fn = () =>
        new MongooseDatasource(mongoose.connection, {
          flattenMode: 'manual',
          flattenOptions: { aModel: { asModels: ['nested.objectList.id'] } },
        });

      expect(fn).toThrow(
        'Either add all intermediary arrays to asModels, or remove it from asModels.',
      );
    });

    test('should throw flattening field at root of main model', async () => {
      const fn = () =>
        new MongooseDatasource(mongoose.connection, {
          flattenMode: 'manual',
          flattenOptions: { aModel: { asFields: ['name'] } },
        });

      expect(fn).toThrow('it is already at the root of the model.');
    });

    test('should throw flattening field at root of virtual model', async () => {
      const fn = () =>
        new MongooseDatasource(mongoose.connection, {
          flattenMode: 'manual',
          flattenOptions: {
            aModel: { asFields: ['nested.objectList.name'], asModels: ['nested.objectList'] },
          },
        });

      expect(fn).toThrow('it is already at the root of a collection.');
    });
  });
});
