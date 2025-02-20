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

  test('timeBased() should return the expected format (Quarter)', () => {
    const result = builder.timeBased('Quarter', {
      '1985-10-26': 1,
      '1985-11-27': 2,
      '1986-01-07': 3,
      '1986-01-08': 4,
    });

    expect(result).toStrictEqual([
      { label: 'Q4-1985', values: { value: 3 } },
      { label: 'Q1-1986', values: { value: 7 } },
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

  test('timeBased() should return empty array when null is given for values property', () => {
    const result = builder.timeBased('Year', null);

    expect(result).toStrictEqual([]);
  });

  test('timeBased() should return empty array when empty array is given', () => {
    const result = builder.timeBased('Year', []);

    expect(result).toStrictEqual([]);
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

  describe('multipleTimeBased()', () => {
    test('should return the labels and the key/values for each line', () => {
      const result = builder.multipleTimeBased(
        'Year',
        [
          new Date('1985-10-26'),
          new Date('1986-01-07'),
          new Date('1986-01-08'),
          new Date('1985-10-27'),
        ],
        [
          {
            label: 'firstLine',
            values: [1, 2, 3, null],
          },
          {
            label: 'secondLine',
            values: [4, 2, 6, 7],
          },
        ],
      );

      expect(result).toStrictEqual({
        labels: ['1985', '1986'],
        values: [
          { key: 'firstLine', values: [1, 5] },
          { key: 'secondLine', values: [11, 8] },
        ],
      });
    });

    describe('when there are only null values for a time range', () => {
      it('should display 0', () => {
        const result = builder.multipleTimeBased(
          'Year',
          [
            new Date('1985-10-26'),
            new Date('1986-01-07'),
            new Date('1986-01-08'),
            new Date('1985-10-27'),
          ],
          [{ label: 'firstLine', values: [null, 2, 3, null] }],
        );

        expect(result).toStrictEqual({
          labels: ['1985', '1986'],
          values: [{ key: 'firstLine', values: [0, 5] }],
        });
      });
    });

    describe('when there is null and number values for a time range', () => {
      it('should display a number', () => {
        const result = builder.multipleTimeBased(
          'Year',
          [
            new Date('1985-10-26'),
            new Date('1986-01-07'),
            new Date('1986-01-08'),
            new Date('1985-10-27'),
          ],
          [{ label: 'firstLine', values: [100, 1, 2, null] }],
        );

        expect(result).toStrictEqual({
          labels: ['1985', '1986'],
          values: [{ key: 'firstLine', values: [100, 3] }],
        });
      });
    });

    describe('when there is no value for a time range', () => {
      it('should display 0', () => {
        const result = builder.multipleTimeBased(
          'Year',
          [
            new Date('1985-10-26'),
            new Date('1986-01-07'),
            new Date('1986-01-08'),
            new Date('1985-10-27'),
          ],
          [{ label: 'firstLine', values: [0] }],
        );

        expect(result).toStrictEqual({
          labels: ['1985', '1986'],
          values: [{ key: 'firstLine', values: [0, 0] }],
        });
      });
    });

    describe('when there is no date', () => {
      it('should return empty array labels and null values for the line', () => {
        const result = builder.multipleTimeBased('Year', [], [{ label: 'firstLine', values: [0] }]);

        expect(result).toStrictEqual({ labels: [], values: null });
      });
    });

    describe('when there is no line', () => {
      it('should return null labels and empty array for values', () => {
        const result = builder.multipleTimeBased('Year', [new Date('1985-10-26')], []);

        expect(result).toStrictEqual({ labels: null, values: null });
      });
    });

    describe('when there are no date and lines', () => {
      it('should return null labels and values', () => {
        const result = builder.multipleTimeBased('Year', null, null);

        expect(result).toStrictEqual({ labels: null, values: null });
      });
    });
  });
});
