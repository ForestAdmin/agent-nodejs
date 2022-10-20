import * as factories from '../__factories__';
import { ChartType } from '../../src/charts/types';
import { CollectionActionEvent, CustomActionEvent } from '../../src/permissions/types';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from '../../src/permissions/generate-action-identifier';
import PermissionServiceWithCache from '../../src/permissions/permission-with-cache';

jest.mock('../../src/permissions/generate-action-identifier', () => ({
  generateCollectionActionIdentifier: jest.fn(),
  generateCustomActionIdentifier: jest.fn(),
}));

const generateCollectionActionIdentifierMock = generateCollectionActionIdentifier as jest.Mock;
const generateCustomActionIdentifierMock = generateCustomActionIdentifier as jest.Mock;

describe('PermissionService', () => {
  describe('canOnCollection', () => {
    it('should return the result of actionPermissionService and pass the right event', async () => {
      const userId = 1;
      const collectionName = 'collectionName';
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const permissionService = new PermissionServiceWithCache(
        actionPermissionService,
        factories.renderingPermission.build(),
      );

      generateCollectionActionIdentifierMock.mockReturnValue('identifier');
      (actionPermissionService.can as jest.Mock).mockResolvedValue(true);

      const result = await permissionService.canOnCollection({
        userId,
        event: CollectionActionEvent.Add,
        collectionName,
      });

      expect(actionPermissionService.can).toHaveBeenCalledWith(`${userId}`, 'identifier');

      expect(generateCollectionActionIdentifierMock).toHaveBeenCalledWith(
        CollectionActionEvent.Add,
        collectionName,
      );
      expect(result).toBe(true);
    });
  });

  describe('canExecuteSegmentQuery', () => {
    it('should test if the segment query is authorized on the rendering', async () => {
      const userId = 1;
      const collectionName = 'collectionName';
      const renderingId = 1;
      const segmentQuery = 'segmentQuery';
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const permissionService = new PermissionServiceWithCache(
        factories.actionPermission.build(),
        renderingPermissionService,
      );

      (renderingPermissionService.canExecuteSegmentQuery as jest.Mock).mockResolvedValue(true);

      const result = await permissionService.canExecuteSegmentQuery({
        userId,
        collectionName,
        renderingId,
        segmentQuery,
      });

      expect(renderingPermissionService.canExecuteSegmentQuery).toHaveBeenCalledWith({
        userId,
        collectionName,
        renderingId,
        segmentQuery,
      });
      expect(result).toBe(true);
    });
  });

  describe('canTriggerCustomAction', () => {
    it('should return the result of actionPermissionService and pass the right event', async () => {
      const userId = 1;
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const permissionService = new PermissionServiceWithCache(
        actionPermissionService,
        factories.renderingPermission.build(),
      );

      generateCustomActionIdentifierMock.mockReturnValue('identifier');
      (actionPermissionService.can as jest.Mock).mockResolvedValue(true);

      const result = await permissionService.canTriggerCustomAction({
        userId,
        customActionName: 'do-something',
        collectionName: 'actors',
      });

      expect(actionPermissionService.can).toHaveBeenCalledWith(`${userId}`, 'identifier');

      expect(generateCustomActionIdentifierMock).toHaveBeenCalledWith(
        CustomActionEvent.Trigger,
        'do-something',
        'actors',
      );
      expect(result).toBe(true);
    });
  });

  describe('canApproveCustomAction', () => {
    describe('when the user is the requester', () => {
      it('should test for the SelfApprove right', async () => {
        const actionPermissionService = factories.actionPermission.mockAllMethods().build();
        const permissionService = new PermissionServiceWithCache(
          actionPermissionService,
          factories.renderingPermission.build(),
        );

        generateCustomActionIdentifierMock.mockReturnValue('identifier');

        (actionPermissionService.can as jest.Mock).mockResolvedValue(true);

        const result = await permissionService.canApproveCustomAction({
          userId: 1,
          customActionName: 'do-something',
          collectionName: 'actors',
          requesterId: 1,
        });

        expect(actionPermissionService.can).toHaveBeenCalledWith('1', 'identifier');
        expect(generateCustomActionIdentifierMock).toHaveBeenCalledWith(
          CustomActionEvent.SelfApprove,
          'do-something',
          'actors',
        );

        expect(result).toBe(true);
      });
    });

    describe('when the user is not the requester', () => {
      it('should test for the Approve right', async () => {
        const actionPermissionService = factories.actionPermission.mockAllMethods().build();
        const permissionService = new PermissionServiceWithCache(
          actionPermissionService,
          factories.renderingPermission.build(),
        );

        generateCustomActionIdentifierMock.mockReturnValue('identifier');

        (actionPermissionService.can as jest.Mock).mockResolvedValue(true);

        const result = await permissionService.canApproveCustomAction({
          userId: 42,
          customActionName: 'do-something',
          collectionName: 'actors',
          requesterId: 1,
        });

        expect(actionPermissionService.can).toHaveBeenCalledWith('42', 'identifier');
        expect(generateCustomActionIdentifierMock).toHaveBeenCalledWith(
          CustomActionEvent.Approve,
          'do-something',
          'actors',
        );

        expect(result).toBe(true);
      });
    });
  });

  describe('canRequestCustomActionParameters', () => {
    it('should check if the user has the right to trigger or trigger with approval', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const permissionService = new PermissionServiceWithCache(
        actionPermissionService,
        factories.renderingPermission.build(),
      );

      (actionPermissionService.canOneOf as jest.Mock).mockResolvedValue(true);
      generateCustomActionIdentifierMock.mockReturnValueOnce('identifier1');
      generateCustomActionIdentifierMock.mockReturnValueOnce('identifier2');

      const result = await permissionService.canRequestCustomActionParameters({
        userId: 42,
        customActionName: 'doSomething',
        collectionName: 'jedis',
      });

      expect(actionPermissionService.canOneOf).toHaveBeenCalledWith('42', [
        'identifier1',
        'identifier2',
      ]);
      expect(generateCustomActionIdentifierMock).toHaveBeenCalledWith(
        CustomActionEvent.Trigger,
        'doSomething',
        'jedis',
      );
      expect(generateCustomActionIdentifierMock).toHaveBeenCalledWith(
        CustomActionEvent.RequireApproval,
        'doSomething',
        'jedis',
      );
      expect(result).toBe(true);
    });
  });

  describe('canRetrieveChart', () => {
    it('should check if the user has the right to display the chart', async () => {
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const permissionService = new PermissionServiceWithCache(
        factories.actionPermission.build(),
        renderingPermissionService,
      );

      (renderingPermissionService.canRetrieveChart as jest.Mock).mockResolvedValue(true);

      const result = await permissionService.canRetrieveChart({
        userId: 42,
        renderingId: 666,
        chartRequest: {
          type: ChartType.Value,
          sourceCollectionName: 'jedi',
          aggregateFieldName: 'strength',
          aggregator: 'Sum',
        },
      });

      expect(renderingPermissionService.canRetrieveChart).toHaveBeenCalledWith({
        userId: 42,
        renderingId: 666,
        chartRequest: {
          type: ChartType.Value,
          sourceCollectionName: 'jedi',
          aggregateFieldName: 'strength',
          aggregator: 'Sum',
        },
      });
      expect(result).toBe(true);
    });
  });
});
