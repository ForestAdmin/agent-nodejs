import ResultBuilder from '../../../src/decorators/chart/result-builder';

describe('Chart result builder', () => {
  const builder = new ResultBuilder();

  test('value() could return the expected format', () => {
    expect(builder.value(34)).toEqual({ countCurrent: 34 });
    expect(builder.value(34, 45)).toEqual({ countCurrent: 34, countPrevious: 45 });
  });

  test('distribution should return the expected format', () => {
    expect(builder.distribution({ a: 10, b: 11 })).toStrictEqual([
      { key: 'a', value: 10 },
      { key: 'b', value: 11 },
    ]);
  });

  test('timeBased() should return the expected format (Day)', () => {
    const result = builder.timeBased('Day', {
      '1985-10-26': 1,
      '1985-10-27': 2,
      '1985-10-30': 3,
    });

    expect(result).toStrictEqual([
      { label: '26/10/1985', values: { value: 1 } },
      { label: '27/10/1985', values: { value: 2 } },
      { label: '28/10/1985', values: { value: 0 } },
      { label: '29/10/1985', values: { value: 0 } },
      { label: '30/10/1985', values: { value: 3 } },
    ]);
  });

  test('timeBased() should return the expected format (Week)', () => {
    const result = builder.timeBased('Week', {
      '1985-12-26': 1,
      '1986-01-07': 3,
      '1986-01-08': 4,
    });

    expect(result).toStrictEqual([
      { label: 'W52-1985', values: { value: 1 } },
      { label: 'W1-1986', values: { value: 0 } },
      { label: 'W2-1986', values: { value: 7 } },
    ]);
  });

  test('timeBased() should return the expected format (Month)', () => {
    const result = builder.timeBased('Month', {
      '1985-10-26': 1,
      '1985-11-27': 2,
      '1986-01-07': 3,
      '1986-01-08': 4,
    });

    expect(result).toStrictEqual([
      { label: 'Oct 85', values: { value: 1 } },
      { label: 'Nov 85', values: { value: 2 } },
      { label: 'Dec 85', values: { value: 0 } },
      { label: 'Jan 86', values: { value: 7 } },
    ]);
  });

  test('timeBased() should return the expected format (Year)', () => {
    const result = builder.timeBased('Year', {
      '1985-10-26': 1,
      '1986-01-07': 3,
      '1986-01-08': 4,
    });

    expect(result).toStrictEqual([
      { label: '1985', values: { value: 1 } },
      { label: '1986', values: { value: 7 } },
    ]);
  });

  test('percentage() is the identify function', () => {
    expect(builder.percentage(34)).toStrictEqual(34);
  });

  test('objective() could return the expected format', () => {
    expect(builder.objective(34, 45)).toEqual({ value: 34, objective: 45 });
  });

  test('leaderboard() is a sorted distribution', () => {
    const result = builder.leaderboard({ a: 10, b: 30, c: 20 });

    expect(result).toStrictEqual([
      { key: 'b', value: 30 },
      { key: 'c', value: 20 },
      { key: 'a', value: 10 },
    ]);
  });

  test('smart() is the identity function', () => {
    expect(builder.smart(34)).toStrictEqual(34);
  });
});
