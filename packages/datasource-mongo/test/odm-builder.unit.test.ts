import { Connection } from 'mongoose';

import { ModelDefinition } from '../src/introspection/types';
import OrmBuilder from '../src/odm-builder/index';

jest.mock('mongoose', () => {
  const Schema = jest.fn().mockImplementation(arg => arg);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Schema as any).Types = {
    Mixed: Symbol('Mixed'),
    ObjectId: Symbol('ObjectId'),
    Binary: Symbol('Binary'),
  };

  return { Schema };
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
          _id: { required: true, type: String },
          author: { required: true, type: String, ref: 'authors' },
          tags: [{ required: true, type: String }],
        },
        'books',
      );
      expect(connection.model).toHaveBeenCalledWith(
        'authors',
        { _id: { required: true, type: String } },
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
          _id: { required: true, type: String },
          title: { required: false, type: String },
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
          _id: { required: true, type: String },
          tags: [{ required: true, type: String }],
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
          _id: { required: true, type: String },
          details: {
            title: { required: true, type: String },
            pages: { required: true, type: Number },
          },
        },
        'books',
      );
    });
  });
});
