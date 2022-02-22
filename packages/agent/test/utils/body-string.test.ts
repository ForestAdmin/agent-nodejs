import { CollectionSchema } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../__factories__';
import BodyStringParser from '../../src/utils/body-string';

describe('BodyStringParserParser', () => {
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
      expect(BodyStringParser.parseSelectionIds(setupSchema(), context)).toEqual({
        areExcluded: false,
        ids: [['2d162303-78bf-599e-b197-93590ac3d315']],
      });
    });

    test('should return ids when is passed by data.ids', () => {
      const context = createMockContext({
        requestBody: {
          data: { ids: ['2d162303-78bf-599e-b197-93590ac3d315'] },
        },
      });
      expect(BodyStringParser.parseSelectionIds(setupSchema(), context)).toEqual({
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
      expect(BodyStringParser.parseSelectionIds(setupSchema(), context)).toEqual({
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
      expect(BodyStringParser.parseSelectionIds(setupSchema(), context)).toEqual({
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
      expect(() => BodyStringParser.parseSelectionIds(setupSchema(), context)).toThrowError();
    });
  });
});
