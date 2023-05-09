import { Connection } from 'mongoose';

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
  test('with a reference', () => {
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
