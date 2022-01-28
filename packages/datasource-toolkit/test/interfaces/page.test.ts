import Page, { constants } from '../../dist/interfaces/query/page';

const { QUERY_PAGE_DEFAULT_LIMIT, QUERY_PAGE_DEFAULT_SKIP } = constants;

describe('Page', () => {
  describe('with default behaviour', () => {
    const page = new Page();

    test('apply should work', () => {
      const records = [...Array(100).keys()].map(id => ({ id }));
      const pageRecords = page.apply(records);

      expect(pageRecords).toBeArrayOfSize(QUERY_PAGE_DEFAULT_LIMIT);
      expect(pageRecords[0]).toEqual(records[QUERY_PAGE_DEFAULT_SKIP]);
    });
  });

  describe('with a finite page', () => {
    const page = new Page(7, 3);

    test('apply should work', () => {
      const records = [...Array(100).keys()].map(id => ({ id }));

      expect(page.apply(records)).toStrictEqual([{ id: 7 }, { id: 8 }, { id: 9 }]);
    });
  });

  describe('with an infinite page', () => {
    const page = new Page(0, 100);

    test('apply should work', () => {
      const records = [...Array(100).keys()].map(id => ({ id }));
      expect(page.apply(records)).toHaveLength(100);
    });
  });
});
