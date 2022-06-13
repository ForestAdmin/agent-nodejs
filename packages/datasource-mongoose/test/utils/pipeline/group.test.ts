import { Aggregation } from '@forestadmin/datasource-toolkit';

import GroupGenerator from '../../../src/utils/pipeline/group';

describe('GroupGenerator', () => {
  it('should work with sum (w/o field nor group)', () => {
    const aggregation = new Aggregation({ operation: 'Sum', field: 'price' });

    expect(GroupGenerator.group(aggregation)).toStrictEqual([
      { $group: { _id: null, value: { $sum: '$price' } } },
      { $project: { _id: 0, group: { $literal: {} }, value: '$value' } },
    ]);
  });

  it('should work with count (w/o field nor group)', () => {
    const aggregation = new Aggregation({ operation: 'Count' });

    expect(GroupGenerator.group(aggregation)).toStrictEqual([
      { $group: { _id: null, value: { $sum: 1 } } },
      { $project: { _id: 0, group: { $literal: {} }, value: '$value' } },
    ]);
  });

  it('should work with count (w/ field)', () => {
    const aggregation = new Aggregation({ operation: 'Count', field: 'title' });

    expect(GroupGenerator.group(aggregation)).toStrictEqual([
      { $group: { _id: null, value: { $sum: { $cond: [{ $ne: ['$title', null] }, 1, 0] } } } },
      { $project: { _id: 0, group: { $literal: {} }, value: '$value' } },
    ]);
  });

  it('should work with count (w/ groups)', () => {
    const aggregation = new Aggregation({ operation: 'Count', groups: [{ field: 'title' }] });

    expect(GroupGenerator.group(aggregation)).toStrictEqual([
      { $group: { _id: { title: '$title' }, value: { $sum: 1 } } },
      { $project: { _id: 0, group: { title: '$_id.title' }, value: '$value' } },
    ]);
  });

  it('should work with count (w/ groups by month)', () => {
    const aggregation = new Aggregation({
      operation: 'Count',
      groups: [{ field: 'createdAt', operation: 'Month' }],
    });

    expect(GroupGenerator.group(aggregation)).toStrictEqual([
      {
        $group: {
          _id: { createdAt: { $dateToString: { date: '$createdAt', format: '%Y-%m-01' } } },
          value: { $sum: 1 },
        },
      },
      { $project: { _id: 0, group: { createdAt: '$_id.createdAt' }, value: '$value' } },
    ]);
  });

  it('should work with count (w/ groups by week)', () => {
    const aggregation = new Aggregation({
      operation: 'Count',
      groups: [{ field: 'createdAt', operation: 'Week' }],
    });

    expect(GroupGenerator.group(aggregation)).toStrictEqual([
      {
        $group: {
          _id: {
            createdAt: {
              $dateToString: {
                date: { $dateTrunc: { date: '$createdAt', startOfWeek: 'Monday', unit: 'week' } },
                format: '%Y-%m-%d',
              },
            },
          },
          value: { $sum: 1 },
        },
      },
      { $project: { _id: 0, group: { createdAt: '$_id.createdAt' }, value: '$value' } },
    ]);
  });
});
