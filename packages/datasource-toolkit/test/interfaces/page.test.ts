import Page from '../../dist/interfaces/query/page';

describe('Page', () => {
  describe('with a finite page', () => {
    const page = new Page(10, 5);

    test('apply should work', () => {
      const records = [...Array(100).keys()].map(id => ({ id }));

      expect(page.apply(records)).toStrictEqual([
        { id: 10 },
        { id: 11 },
        { id: 12 },
        { id: 13 },
        { id: 14 },
      ]);
    });
  });

  describe('with an infinite page', () => {
    const page = new Page();

    test('apply should work', () => {
      const records = [...Array(100).keys()].map(id => ({ id }));
      expect(page.apply(records)).toHaveLength(100);
    });
  });
});
