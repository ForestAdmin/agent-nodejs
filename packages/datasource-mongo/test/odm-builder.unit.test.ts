import type { ModelDefinition } from '../src/introspection/types';
import type { Connection } from 'mongoose';

import { Schema } from 'mongoose';

import OrmBuilder from '../src/odm-builder/index';

jest.mock('mongoose', () => {
  const SchemaMocked = jest.fn().mockImplementation(arg => arg);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (SchemaMocked as any).Types = {
    Mixed: Symbol('Mixed'),
    ObjectId: Symbol('ObjectId'),
    Binary: Symbol('Binary'),
  };

  return { Schema: SchemaMocked, version: '7' };
});

describe('odm builder', () => {
  describe('with a reference', () => {
    it('should declare the reference in the model', () => {
      const connection = { model: jest.fn() } as unknown as Connection;
      const authors = {
        name: 'authors',
        analysis: {
          type: 'object',
          nullable: false,
          object: { _id: { type: 'string', nullable: false } },
        },
      } as const;

      const books = {
        name: 'books',
        analysis: {
          type: 'object',
          nullable: false,
          object: {
            _id: { type: 'string', nullable: false },
            author: { type: 'string', nullable: false, referenceTo: 'authors' },
            tags: {
              type: 'array',
              nullable: false,
              arrayElement: { type: 'string', nullable: false },
            },
          },
        },
      } as const;

      OrmBuilder.defineModels(connection, [books, authors]);

      expect(connection.model).toHaveBeenCalledWith(
        'books',
        {
          _id: { required: true, type: String, auto: false },
          author: { required: true, type: String, ref: 'authors', auto: false },
          tags: [{ required: true, type: String, auto: false }],
        },
        'books',
      );
      expect(connection.model).toHaveBeenCalledWith(
        'authors',
        { _id: { required: true, type: String, auto: false } },
        'authors',
      );
    });
  });

  describe('with nullable fields', () => {
    it('should set required: false', () => {
      const connection = { model: jest.fn() } as unknown as Connection;
      const books: ModelDefinition = {
        name: 'books',
        analysis: {
          type: 'object',
          nullable: false,
          object: {
            _id: { type: 'string', nullable: false },
            title: { type: 'string', nullable: true },
          },
        },
      };

      OrmBuilder.defineModels(connection, [books]);

      expect(connection.model).toHaveBeenCalledWith(
        'books',
        {
          _id: { required: true, type: String, auto: false },
          title: { required: false, type: String, auto: false },
        },
        'books',
      );
    });
  });

  describe('with array fields', () => {
    it('should declare the field as an array', () => {
      const connection = { model: jest.fn() } as unknown as Connection;
      const books: ModelDefinition = {
        name: 'books',
        analysis: {
          type: 'object',
          nullable: false,
          object: {
            _id: { type: 'string', nullable: false },
            tags: {
              type: 'array',
              nullable: false,
              arrayElement: { type: 'string', nullable: false },
            },
          },
        },
      };

      OrmBuilder.defineModels(connection, [books]);

      expect(connection.model).toHaveBeenCalledWith(
        'books',
        {
          _id: { required: true, type: String, auto: false },
          tags: [{ required: true, type: String, auto: false }],
        },
        'books',
      );
    });
  });

  describe('with object fields', () => {
    it('should declare the field as an object', () => {
      const connection = { model: jest.fn() } as unknown as Connection;
      const books: ModelDefinition = {
        name: 'books',
        analysis: {
          type: 'object',
          nullable: false,
          object: {
            _id: { type: 'string', nullable: false },
            details: {
              type: 'object',
              nullable: false,
              object: {
                title: { type: 'string', nullable: false },
                pages: { type: 'number', nullable: false },
              },
            },
          },
        },
      };

      OrmBuilder.defineModels(connection, [books]);

      expect(connection.model).toHaveBeenCalledWith(
        'books',
        {
          _id: { required: true, type: String, auto: false },
          details: {
            title: { required: true, type: String, auto: false },
            pages: { required: true, type: Number, auto: false },
          },
        },
        'books',
      );
    });
  });

  describe('with ids', () => {
    it('should declare the field as auto and not required', () => {
      const connection = { model: jest.fn() } as unknown as Connection;
      const books: ModelDefinition = {
        name: 'books',
        analysis: {
          type: 'object',
          nullable: false,
          object: {
            _id: { type: 'ObjectId', nullable: false },
            title: { type: 'string', nullable: false },
          },
        },
      };

      OrmBuilder.defineModels(connection, [books]);

      expect(connection.model).toHaveBeenCalledWith(
        'books',
        {
          _id: { required: false, type: Schema.Types.ObjectId, auto: true },
          title: { required: true, type: String, auto: false },
        },
        'books',
      );
    });

    it('should declare the field as required and not auto if the type is not objectId', () => {
      const connection = { model: jest.fn() } as unknown as Connection;
      const books: ModelDefinition = {
        name: 'books',
        analysis: {
          type: 'object',
          nullable: false,
          object: {
            _id: { type: 'string', nullable: false },
            title: { type: 'string', nullable: false },
          },
        },
      };

      OrmBuilder.defineModels(connection, [books]);

      expect(connection.model).toHaveBeenCalledWith(
        'books',
        {
          _id: { required: true, type: String, auto: false },
          title: { required: true, type: String, auto: false },
        },
        'books',
      );
    });
  });

  describe('with __v', () => {
    it('should not declare the __v field', () => {
      const connection = { model: jest.fn() } as unknown as Connection;
      const books: ModelDefinition = {
        name: 'books',
        analysis: {
          type: 'object',
          nullable: false,
          object: {
            _id: { type: 'string', nullable: false },
            __v: { type: 'number', nullable: false },
          },
        },
      };

      OrmBuilder.defineModels(connection, [books]);

      expect(connection.model).toHaveBeenCalledWith(
        'books',
        {
          _id: { required: true, type: String, auto: false },
        },
        'books',
      );
      expect(Schema).toHaveBeenCalledWith(
        { _id: { required: true, type: String, auto: false } },
        {
          versionKey: '__v',
        },
      );
    });

    it('should not use the versionKey if __v is not present', () => {
      const connection = { model: jest.fn() } as unknown as Connection;
      const books: ModelDefinition = {
        name: 'books',
        analysis: {
          type: 'object',
          nullable: false,
          object: {
            _id: { type: 'string', nullable: false },
          },
        },
      };

      OrmBuilder.defineModels(connection, [books]);

      expect(connection.model).toHaveBeenCalledWith(
        'books',
        {
          _id: { required: true, type: String, auto: false },
        },
        'books',
      );
      expect(Schema).toHaveBeenCalledWith(
        { _id: { required: true, type: String, auto: false } },
        {
          versionKey: false,
        },
      );
    });
  });
});
