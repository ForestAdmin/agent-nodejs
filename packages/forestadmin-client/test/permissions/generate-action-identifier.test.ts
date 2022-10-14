import { CollectionActionEvent, CustomActionEvent } from '../../src/permissions/types';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from '../../src/permissions/generate-action-identifier';

describe('generateActionIdentifier', () => {
  describe('generateCustomActionIdentifier', () => {
    describe.each(Object.values(CustomActionEvent))('with permission %s', permission => {
      it('should generate an identifier for the custom action permission', () => {
        const identifier = generateCustomActionIdentifier(permission, 'customAction', 'collection');
        expect(identifier).toEqual(`custom:collection:customAction:${permission}`);
      });
    });
  });

  describe('generateCollectionActionIdentifier', () => {
    describe.each(Object.values(CollectionActionEvent))('with permission %s', permission => {
      it('should generate an identifier for the collection action permission', () => {
        const identifier = generateCollectionActionIdentifier(permission, 'collectionName');
        expect(identifier).toEqual(`collection:collectionName:${permission}`);
      });
    });
  });
});
