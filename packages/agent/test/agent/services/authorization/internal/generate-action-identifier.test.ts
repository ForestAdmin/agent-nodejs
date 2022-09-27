import { CollectionActionEvent } from '../../../../../src/agent/services/authorization/internal/types';
import { CustomActionEvent } from '../../../../../src/agent/services/authorization';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from '../../../../../src/agent/services/authorization/internal/generate-action-identifier';

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
