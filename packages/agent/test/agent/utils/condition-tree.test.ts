import { ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import * as factories from '../__factories__';
import ConditionTreeParser from '../../../src/agent/utils/condition-tree-parser';

describe('ConditionTreeParser', () => {
  const collection = factories.collection.build({
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build(),
        name: factories.columnSchema.build(),
      },
    }),
  });

  test('should work with snake case', () => {
    const tree = ConditionTreeParser.fromPlainObject(collection, {
      field: 'id',
      operator: 'less_than',
      value: 'something',
    });

    expect(tree).toStrictEqual(new ConditionTreeLeaf('id', 'LessThan', 'something'));
  });

  test('should work with in operator', () => {
    const tree = ConditionTreeParser.fromPlainObject(collection, {
      field: 'id',
      operator: 'in',
      value: 'id1,id2 ,  id3',
    });

    expect(tree).toStrictEqual(new ConditionTreeLeaf('id', 'In', ['id1', 'id2', 'id3']));
  });
});
