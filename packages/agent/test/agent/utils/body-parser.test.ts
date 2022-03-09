import { CollectionSchema } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../__factories__';
import BodyParser from '../../../src/agent/utils/body-parser';

describe('BodyParser', () => {
  describe('parseSelectionIds', () => {
    const setupSchema = (): CollectionSchema => {
      return factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
        },
      });
    };

    test('should return ids when is passed by data.attributes.ids', () => {
      const context = createMockContext({
        requestBody: {
          data: { attributes: { ids: ['2d162303-78bf-599e-b197-93590ac3d315'] } },
        },
      });
      expect(BodyParser.parseSelectionIds(setupSchema(), context)).toEqual({
        areExcluded: false,
        ids: [['2d162303-78bf-599e-b197-93590ac3d315']],
      });
    });

    test('should return ids when is passed by data[{id...}]', () => {
      const context = createMockContext({
        requestBody: {
          data: [{ id: '2d162303-78bf-599e-b197-93590ac3d315' }],
        },
      });
      expect(BodyParser.parseSelectionIds(setupSchema(), context)).toEqual({
        areExcluded: false,
        ids: [['2d162303-78bf-599e-b197-93590ac3d315']],
      });
    });

    test('should return ids to exclude', () => {
      const context = createMockContext({
        requestBody: {
          data: {
            attributes: {
              all_records: true,
              all_records_ids_excluded: ['2d162303-78bf-599e-b197-93590ac3d315'],
            },
          },
        },
      });
      expect(BodyParser.parseSelectionIds(setupSchema(), context)).toEqual({
        areExcluded: true,
        ids: [['2d162303-78bf-599e-b197-93590ac3d315']],
      });
    });

    test('should throw error when ids are not passed', () => {
      const context = createMockContext({
        requestBody: {
          data: [{ bad_id: '2d162303-78bf-599e-b197-93590ac3d315' }],
        },
      });
      expect(() => BodyParser.parseSelectionIds(setupSchema(), context)).toThrowError();
    });

    describe('when some attributes are badly provided', () => {
      test.each([
        ['no body is provided', null, 'Expected array, received: undefined'],
        [
          'body does not contains data',
          { datum: 'something' },
          'Expected array, received: undefined',
        ],
        [
          'body does not contains attributes',
          { data: 'something' },
          'Expected array, received: undefined',
        ],
        [
          'ids are not provided',
          { data: { attributes: { badIdsAttribute: ['1523', '5684'] } } },
          'Expected array, received: undefined',
        ],
        [
          'ids_excluded are not provided',
          { data: { attributes: { ids: ['1523', '5684'], all_records: true } } },
          'Expected array, received: undefined',
        ],
        [
          'ids and ids_excluded are not the expected type',
          {
            data: {
              attributes: {
                all_records: ['not', 'a', 'boolean'],
                ids: 'not_an_array',
                all_records_ids_excluded: 45,
              },
            },
          },
          'Expected array, received: number',
        ],
        [
          'ids and ids_excluded members are not the expected type',
          {
            data: {
              attributes: {
                all_records: true,
                ids: ['string', 'string'],
                all_records_ids_excluded: ['string'],
              },
            },
          },
          'Wrong type for "id": string. Expects Uuid',
        ],
      ])('should throw an error when %s', async (_, body, errorMessage) => {
        const context = createMockContext({ requestBody: body });
        expect(() => BodyParser.parseSelectionIds(setupSchema(), context)).toThrowError(
          errorMessage,
        );
      });
    });
  });
});
