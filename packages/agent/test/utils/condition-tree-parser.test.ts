import { ConditionTreeBranch, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import ConditionTreeParser from '../../src/utils/condition-tree-parser';
import * as factories from '../__factories__';

describe('ConditionTreeParser', () => {
  const collection = factories.collection.build({
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.uuidPrimaryKey().build(),
        string: factories.columnSchema.build({ columnType: 'String' }),
        number: factories.columnSchema.build({ columnType: 'Number' }),
        boolean: factories.columnSchema.build({ columnType: 'Boolean' }),
      },
    }),
  });

  test('should failed if provided something else', () => {
    expect(() => ConditionTreeParser.fromPlainObject(collection, {})).toThrow(
      'Failed to instantiate condition tree from json',
    );
  });

  test('should work with aggregator', () => {
    const tree = ConditionTreeParser.fromPlainObject(collection, {
      aggregator: 'and',
      conditions: [
        { field: 'id', operator: 'less_than', value: 'something' },
        { field: 'id', operator: 'greater_than', value: 'something' },
      ],
    });

    expect(tree).toStrictEqual(
      new ConditionTreeBranch('And', [
        new ConditionTreeLeaf('id', 'LessThan', 'something'),
        new ConditionTreeLeaf('id', 'GreaterThan', 'something'),
      ]),
    );
  });

  test('should keep a group of And nested in an Or', () => {
    const tree = ConditionTreeParser.fromPlainObject(collection, {
      aggregator: 'or',
      conditions: [
        {
          aggregator: 'and',
          conditions: [
            { field: 'number', operator: 'greater_than', value: '1' },
            { field: 'boolean', operator: 'equal', value: 'true' },
          ],
        },
        { field: 'string', operator: 'equal', value: 'a' },
      ],
    });

    expect(tree).toStrictEqual(
      new ConditionTreeBranch('Or', [
        new ConditionTreeBranch('And', [
          new ConditionTreeLeaf('number', 'GreaterThan', 1),
          new ConditionTreeLeaf('boolean', 'Equal', true),
        ]),
        new ConditionTreeLeaf('string', 'Equal', 'a'),
      ]),
    );
  });

  test('should unwrap a nested group holding a single condition', () => {
    const tree = ConditionTreeParser.fromPlainObject(collection, {
      aggregator: 'and',
      conditions: [
        { aggregator: 'or', conditions: [{ field: 'string', operator: 'equal', value: 'a' }] },
        { field: 'number', operator: 'equal', value: 2 },
      ],
    });

    expect(tree).toStrictEqual(
      new ConditionTreeBranch('And', [
        new ConditionTreeLeaf('string', 'Equal', 'a'),
        new ConditionTreeLeaf('number', 'Equal', 2),
      ]),
    );
  });

  test.each(['and', 'or'])('should reject an empty nested %s group', aggregator => {
    expect(() =>
      ConditionTreeParser.fromPlainObject(collection, {
        aggregator: 'and',
        conditions: [
          { field: 'string', operator: 'equal', value: 'a' },
          { aggregator, conditions: [] },
        ],
      }),
    ).toThrow('A nested group of conditions cannot be empty');
  });

  test('should reject an empty group nested deeper than one level', () => {
    expect(() =>
      ConditionTreeParser.fromPlainObject(collection, {
        aggregator: 'or',
        conditions: [
          { field: 'string', operator: 'equal', value: 'a' },
          { aggregator: 'and', conditions: [{ aggregator: 'or', conditions: [] }] },
        ],
      }),
    ).toThrow('A nested group of conditions cannot be empty');
  });

  test.each([
    ['a null condition', { aggregator: 'and', conditions: [null] }],
    ['conditions that are not an array', { aggregator: 'or', conditions: 'x' }],
  ])('should reject a group holding %s', (_, json) => {
    expect(() => ConditionTreeParser.fromPlainObject(collection, json)).toThrow(
      'Failed to instantiate condition tree from json',
    );
  });

  test('should keep an empty root group as an empty branch', () => {
    const tree = ConditionTreeParser.fromPlainObject(collection, {
      aggregator: 'and',
      conditions: [],
    });

    expect(tree).toStrictEqual(new ConditionTreeBranch('And', []));
  });

  test('should work with snake case', () => {
    const tree = ConditionTreeParser.fromPlainObject(collection, {
      field: 'id',
      operator: 'less_than',
      value: 'something',
    });

    expect(tree).toStrictEqual(new ConditionTreeLeaf('id', 'LessThan', 'something'));
  });

  test('should work with in and string', () => {
    const tree = ConditionTreeParser.fromPlainObject(collection, {
      field: 'id',
      operator: 'in',
      value: 'id1,id2 ,  id3',
    });

    expect(tree).toStrictEqual(new ConditionTreeLeaf('id', 'In', ['id1', 'id2', 'id3']));
  });

  test('should work with not in and string', () => {
    const tree = ConditionTreeParser.fromPlainObject(collection, {
      field: 'id',
      operator: 'not_in',
      value: 'id1,id2 ,  id3',
    });

    expect(tree).toStrictEqual(new ConditionTreeLeaf('id', 'NotIn', ['id1', 'id2', 'id3']));
  });

  test('should work with in and number', () => {
    const tree = ConditionTreeParser.fromPlainObject(collection, {
      field: 'number',
      operator: 'in',
      value: '1, 2, 3 , invalid',
    });

    expect(tree).toStrictEqual(new ConditionTreeLeaf('number', 'In', [1, 2, 3]));
  });

  test('should work with in and boolean', () => {
    const tree = ConditionTreeParser.fromPlainObject(collection, {
      field: 'boolean',
      operator: 'in',
      value: 'true, 0, false, yes, no',
    });

    expect(tree).toStrictEqual(
      new ConditionTreeLeaf('boolean', 'In', [true, false, false, true, false]),
    );
  });

  test('should work with ShorterThan and string', () => {
    const tree = ConditionTreeParser.fromPlainObject(collection, {
      field: 'string',
      operator: 'ShorterThan',
      value: '12',
    });

    expect(tree).toStrictEqual(new ConditionTreeLeaf('string', 'ShorterThan', 12));
  });

  test('should work with Equal string when passing number', () => {
    const tree = ConditionTreeParser.fromPlainObject(collection, {
      field: 'string',
      operator: 'Equal',
      value: 134,
    });

    expect(tree).toStrictEqual(new ConditionTreeLeaf('string', 'Equal', '134'));
  });
});
