import { ConditionTreeBranch, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import * as factories from '../__factories__';
import ConditionTreeParser from '../../src/utils/condition-tree-parser';

describe('ConditionTreeParser', () => {
  const collection = factories.collection.build({
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build(),
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
