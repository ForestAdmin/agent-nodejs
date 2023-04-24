import { Types } from 'mongoose';

import * as helpers from '../../src/utils/helpers';

describe('helpers', () => {
  it('escape replace dots by underscores', () => {
    const result = helpers.escape('a.b.c');

    expect(result).toStrictEqual('a_b_c');
  });

  it('recursiveSet should recursively set a value in a plain object', () => {
    const obj = {};
    helpers.recursiveSet(obj, 'a.b.c', 1);
    helpers.recursiveSet(obj, 'a.b.d', 2);

    expect(obj).toStrictEqual({ a: { b: { c: 1, d: 2 } } });
  });

  it('compareIds should compate using both ordinal and lexicographical order', () => {
    expect(helpers.compareIds('a', 'a')).toEqual(0);

    expect(helpers.compareIds('a', 'b')).toBeLessThan(0);
    expect(helpers.compareIds('b', 'a')).toBeGreaterThan(0);

    expect(helpers.compareIds('a', 'a.b')).toBeLessThan(0);
    expect(helpers.compareIds('a.b', 'a')).toBeGreaterThan(0);

    expect(helpers.compareIds('a.2.b', 'a.10.a')).toBeLessThan(0);
    expect(helpers.compareIds('a.10.a', 'a.2.b')).toBeGreaterThan(0);
  });

  it('splitId should separate rootId and path', () => {
    expect(helpers.splitId('a.b.c')).toStrictEqual(['a', 'b.c']);

    // @fixme this behavior should change, see source file.
    expect(helpers.splitId('5a934e000102030405000000.c')).toStrictEqual([
      new Types.ObjectId('5a934e000102030405000000'),
      'c',
    ]);
  });

  it('groupIdsByPath regroup rootIds by path', () => {
    const groups = helpers.groupIdsByPath(['a.b.c', 'b.b.c', 'a.b.d']);

    expect(groups).toStrictEqual({
      'b.c': ['a', 'b'],
      'b.d': ['a'],
    });
  });

  it('replaceMongoTypes should replace objectids and dates by strings', () => {
    const record = helpers.replaceMongoTypes({
      nested: [
        {
          _id: new Types.ObjectId('5a934e000102030405000000'),
          date: new Date('1985-10-26T01:22:00-08:00'),
        },
      ],
    });

    expect(record).toEqual({
      nested: [{ _id: '5a934e000102030405000000', date: '1985-10-26T09:22:00.000Z' }],
    });
  });
});
