import ForestValueConverter from '../../../src/utils/forest-schema/action-values';
import * as factories from '../../__factories__';

describe('ForestValueConverter', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'reviews',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.numericPrimaryKey().build(),
        },
      }),
    }),
  ]);

  describe('makeFormData', () => {
    test('should ignore the special "Loading" field', () => {
      const fields = [];
      const data = { 'Loading...': 'hello' };
      const formData = ForestValueConverter.makeFormData(dataSource, data, fields);

      expect(formData).toStrictEqual({});
    });

    test('should unserialize ids', () => {
      const fields = [
        {
          label: 'review',
          type: 'Collection' as const,
          watchChanges: false,
          collectionName: 'reviews',
        },
      ];
      const data = { review: '23' };
      const formData = ForestValueConverter.makeFormData(dataSource, data, fields);

      expect(formData).toStrictEqual({ review: [23] });
    });

    test('should unserialize files when relevant', () => {
      const fields = [
        { label: 'file', type: 'File' as const, watchChanges: false },
        { label: 'file2', type: 'String' as const, watchChanges: false },
        { label: 'file3', type: 'FileList' as const, watchChanges: false },
      ];

      const data = {
        file: 'data:text/csv;name=toto.csv;charset=utf8;base64,AAAA',
        file2: 'data:text/csv;name=toto.csv;charset=utf8;base64,AAAA',
        file3: ['data:text/csv;name=toto.csv;charset=utf8;base64,AAAA'],
      };

      const formData = ForestValueConverter.makeFormData(dataSource, data, fields);

      expect(formData).toStrictEqual({
        file: {
          name: 'toto.csv',
          charset: 'utf8',
          mimeType: 'text/csv',
          buffer: Buffer.from([0, 0, 0]), // b64:AAAA === 0x000000
        },
        file2: 'data:text/csv;name=toto.csv;charset=utf8;base64,AAAA',
        file3: [
          {
            name: 'toto.csv',
            charset: 'utf8',
            mimeType: 'text/csv',
            buffer: Buffer.from([0, 0, 0]), // b64:AAAA === 0x000000
          },
        ],
      });
    });

    test('should leave the rest without changing it', () => {
      const fields = [];
      const data = { review: '23' };
      const formData = ForestValueConverter.makeFormData(dataSource, data, fields);

      expect(formData).toStrictEqual({ review: '23' });
    });
  });

  describe('makeFormDataFromFields', () => {
    test('should ignore the special "Loading" field', () => {
      const fields = [{ field: 'Loading...', value: 'hello' }];
      const formData = ForestValueConverter.makeFormDataFromFields(dataSource, fields);

      expect(formData).toStrictEqual({});
    });

    test('should unserialize ids', () => {
      const fields = [{ field: 'review', type: 'Number', reference: 'reviews.id', value: '23' }];
      const formData = ForestValueConverter.makeFormDataFromFields(dataSource, fields);

      expect(formData).toStrictEqual({ review: [23] });
    });

    test('should unserialize files when relevant', () => {
      const fields = [
        {
          field: 'file',
          type: 'File',
          value: 'data:text/csv;name=toto.csv;charset=utf8;base64,AAAA',
        },
        {
          field: 'file2',
          type: 'String',
          value: 'data:text/csv;name=toto.csv;charset=utf8;base64,AAAA',
        },
        {
          field: 'file3',
          type: ['File'],
          value: ['data:text/csv;name=toto.csv;charset=utf8;base64,AAAA'],
        },
      ];

      const formData = ForestValueConverter.makeFormDataFromFields(dataSource, fields);

      expect(formData).toStrictEqual({
        file: {
          name: 'toto.csv',
          charset: 'utf8',
          mimeType: 'text/csv',
          buffer: Buffer.from([0, 0, 0]), // b64:AAAA === 0x000000
        },
        file2: 'data:text/csv;name=toto.csv;charset=utf8;base64,AAAA',
        file3: [
          {
            name: 'toto.csv',
            charset: 'utf8',
            mimeType: 'text/csv',
            buffer: Buffer.from([0, 0, 0]), // b64:AAAA === 0x000000
          },
        ],
      });
    });

    test('should leave the rest without changing it', () => {
      const fields = [{ field: 'review', type: 'invalid', value: '23' }];
      const formData = ForestValueConverter.makeFormDataFromFields(dataSource, fields);

      expect(formData).toStrictEqual({ review: '23' });
    });
  });

  describe('makeFormDataUnsafe', () => {
    test('should ignore the special "Loading" field', () => {
      const data = { 'Loading...': 'hello' };
      const formData = ForestValueConverter.makeFormDataUnsafe(data);

      expect(formData).toStrictEqual({});
    });

    test('should unserialize files when relevant', () => {
      const data = {
        file: 'data:text/csv;name=toto.csv;charset=utf8;base64,AAAA',
        file3: ['data:text/csv;name=toto.csv;charset=utf8;base64,AAAA'],
      };

      const formData = ForestValueConverter.makeFormDataUnsafe(data);

      expect(formData).toStrictEqual({
        file: {
          name: 'toto.csv',
          charset: 'utf8',
          mimeType: 'text/csv',
          buffer: Buffer.from([0, 0, 0]), // b64:AAAA === 0x000000
        },
        file3: [
          {
            name: 'toto.csv',
            charset: 'utf8',
            mimeType: 'text/csv',
            buffer: Buffer.from([0, 0, 0]), // b64:AAAA === 0x000000
          },
        ],
      });
    });

    test('should leave the rest without changing it', () => {
      const data = { review: '23' };
      const formData = ForestValueConverter.makeFormDataUnsafe(data);

      expect(formData).toStrictEqual({ review: '23' });
    });
  });

  describe('valueToForest', () => {
    test('should check enums', () => {
      const field = {
        label: 'label',
        type: 'Enum' as const,
        enumValues: ['a', 'b', 'c'],
        watchChanges: false,
      };

      expect(ForestValueConverter.valueToForest(field, 'd')).toEqual(null);
      expect(ForestValueConverter.valueToForest(field, 'c')).toEqual('c');
    });

    test('should check enum lists', () => {
      const field = {
        label: 'label',
        type: 'EnumList' as const,
        enumValues: ['a', 'b', 'c'],
        watchChanges: false,
      };

      expect(ForestValueConverter.valueToForest(field, ['d', 'c'])).toEqual(['c']);
      expect(ForestValueConverter.valueToForest(field, ['c'])).toEqual(['c']);
    });

    test('should pack ids', () => {
      const field = {
        label: 'label',
        type: 'Collection' as const,
        collectionName: 'reviews',
        watchChanges: false,
      };

      expect(ForestValueConverter.valueToForest(field, ['3', 'aa'])).toEqual('3|aa');
    });

    test('should make data uris', () => {
      const field = { label: 'label', type: 'File' as const, watchChanges: false };

      expect(
        ForestValueConverter.valueToForest(field, {
          mimeType: 'text/csv',
          buffer: Buffer.from([0, 0, 0]),
        }),
      ).toEqual('data:text/csv;base64,AAAA');
    });

    test('should make data uris in lists', () => {
      const field = { label: 'label', type: 'FileList' as const, watchChanges: false };

      expect(
        ForestValueConverter.valueToForest(field, [
          {
            mimeType: 'image/jpeg',
            name: 'some thing.jpg',
            charset: 'something',
            buffer: Buffer.from([0, 0, 1]),
          },
        ]),
      ).toEqual(['data:image/jpeg;name=some%20thing.jpg;charset=something;base64,AAAB']);
    });
  });
});
