import factories from '../../__factories__';
import SearchCollectionDecorator from '../../../src/decorators/search/collection';

describe('SearchCollection', () => {
  describe('refineFilter', () => {
    describe('when the given filter is empty', () => {
      test('should return the given filter', () => {
        const collection = factories.collection.build();
        const filter = factories.filter.build({});

        const searchCollectionDecorator = new SearchCollectionDecorator(collection);

        const refinedFilter = searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual(filter);
      });
    });

    describe('when the search is null', () => {
      test('should return the given filter', () => {
        const collection = factories.collection.build();
        const filter = factories.filter.build({ search: null });

        const searchCollectionDecorator = new SearchCollectionDecorator(collection);

        const refinedFilter = searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual(filter);
      });
    });

    describe('when the collection schema is searchable', () => {
      test('should return the given filter', () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({ searchable: true }),
        });
        const filter = factories.filter.build({ search: 'a text' });

        const searchCollectionDecorator = new SearchCollectionDecorator(collection);

        const refinedFilter = searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual(filter);
      });
    });

    describe('when the search is given and the collection schema is not searchable', () => {
      describe('when the search is composed by empty spaces', () => {
        test('should return null', () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.build({ searchable: false }),
          });
          const filter = factories.filter.build({ search: '     ' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection);

          const refinedFilter = searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toStrictEqual(null);
        });
      });
    });
  });
});
