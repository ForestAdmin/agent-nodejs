import Page from '../../dist/interfaces/query/page';

describe('Page', () => {
  const collectionSize = 42;
  const skip = 5;
  const limit = 7;

  describe('with default behaviour', () => {
    test('apply should work', () => {
      const records = [...Array(collectionSize).keys()].map(id => ({ id }));

      const page = new Page();
      const pageRecords = page.apply(records);

      expect(pageRecords).toStrictEqual(pageRecords);
    });
  });

  describe('with only a skip value', () => {
    test('apply should work', () => {
      const records = [...Array(collectionSize).keys()].map(id => ({ id }));

      const page = new Page(skip);

      const pageRecords = page.apply(records);

      expect(pageRecords).toBeArrayOfSize(collectionSize - skip);
      expect(pageRecords).toStrictEqual(records.slice(skip));
    });
  });

  describe('with only a limit value', () => {
    test('apply should work', () => {
      const records = [...Array(collectionSize).keys()].map(id => ({ id }));

      const page = new Page(null, limit);

      const pageRecords = page.apply(records);

      expect(pageRecords).toBeArrayOfSize(limit);
      expect(pageRecords).toStrictEqual(records.slice(0, limit));
    });
  });

  describe('with both skip and limit values', () => {
    test('apply should work', () => {
      const records = [...Array(collectionSize).keys()].map(id => ({ id }));

      const page = new Page(skip, limit);

      const pageRecords = page.apply(records);

      expect(pageRecords).toBeArrayOfSize(limit);
      expect(pageRecords).toStrictEqual(records.slice(skip, skip + limit));
    });
  });

  describe('with a skip larger than the collection size', () => {
    test('apply should work, and return an empty list', () => {
      const records = [...Array(collectionSize).keys()].map(id => ({ id }));

      const page = new Page(collectionSize * 2, limit);

      const pageRecords = page.apply(records);

      expect(pageRecords).toBeArrayOfSize(0);
    });
  });

  describe('with a limit larger than the collection size', () => {
    test('apply should work, and return available items', () => {
      const records = [...Array(collectionSize).keys()].map(id => ({ id }));

      const page = new Page(null, collectionSize * 2);

      const pageRecords = page.apply(records);

      expect(pageRecords).toStrictEqual(pageRecords);
    });
  });
});
