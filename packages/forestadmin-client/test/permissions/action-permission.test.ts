import ActionPermissionService from '../../src/permissions/action-permission';
import generateActionsFromPermissions, {
  ActionPermissions,
} from '../../src/permissions/generate-actions-from-permissions';
import { RawTreeWithSources } from '../../src/permissions/types';
import * as factories from '../__factories__';

jest.mock('../../src/permissions/generate-actions-from-permissions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const generateActionsFromPermissionsMock = generateActionsFromPermissions as jest.Mock;

describe('ActionPermissionService', () => {
  function setup(...actionsPermissions: ActionPermissions[]) {
    const options = {
      permissionsCacheDurationInSeconds: 1,
      envSecret: '123',
      forestServerUrl: 'http://api',
      isProduction: true,
      logger: jest.fn(),
    };
    const serverInterface = factories.forestAdminServerInterface.build();
    const service = new ActionPermissionService(options, serverInterface);

    const permissions = { collections: {} };

    serverInterface.getEnvironmentPermissions = jest.fn().mockResolvedValue(permissions);
    actionsPermissions.forEach(actionPermissions => {
      generateActionsFromPermissionsMock.mockReturnValueOnce(actionPermissions);
    });

    return { service, permissions, options, serverInterface };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isDevelopmentPermission', () => {
    it('should return the value of isDevelopment', async () => {
      const { service } = setup({
        isDevelopment: true,
        actionsByRole: new Map(),
        actionsGloballyAllowed: new Set(),
      });

      const isDevelopmentPermission = await service.isDevelopmentPermission();

      expect(isDevelopmentPermission).toStrictEqual(true);
    });
  });

  describe('can', () => {
    it('should return true if isDevelopment', async () => {
      const { service, options, permissions, serverInterface } = setup({
        isDevelopment: true,
        actionsByRole: new Map(),
        actionsGloballyAllowed: new Set(),
      });

      const can = await service.can(1, 'action');
      expect(can).toBe(true);

      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(1);
      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledWith(options);

      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledWith(permissions);
    });

    it('should return true if the action is globally allowed', async () => {
      const { service } = setup({
        isDevelopment: false,
        actionsByRole: new Map(),
        actionsGloballyAllowed: new Set(['action']),
      });

      const can = await service.can(1, 'action');
      expect(can).toBe(true);
    });

    it('should return true if the action is allowed for the user', async () => {
      const { service } = setup({
        isDevelopment: false,
        actionsByRole: new Map([['action', { allowedRoles: new Set([10]) }]]),
        actionsGloballyAllowed: new Set(),
      });

      const can = await service.can(10, 'action');
      expect(can).toBe(true);
    });

    describe('when the user is not allowed in the first place', () => {
      it('should refresh the cache and return the second result', async () => {
        const { service, serverInterface } = setup(
          {
            isDevelopment: false,
            actionsByRole: new Map(),
            actionsGloballyAllowed: new Set(),
          },
          {
            isDevelopment: true,
            actionsByRole: new Map([]),
            actionsGloballyAllowed: new Set(),
          },
        );

        const can = await service.can(10, 'action');
        expect(can).toBe(true);

        expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });

      it('should return false if the user is still not authorized', async () => {
        const { service, serverInterface } = setup(
          {
            isDevelopment: false,
            actionsByRole: new Map(),
            actionsGloballyAllowed: new Set(),
          },
          {
            isDevelopment: false,
            actionsByRole: new Map([]),
            actionsGloballyAllowed: new Set(),
          },
        );

        const can = await service.can(10, 'action');
        expect(can).toBe(false);

        expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });
    });

    it('should reuse the cache if 2 calls are made in a short time', async () => {
      const { service, options, serverInterface } = setup({
        isDevelopment: false,
        actionsByRole: new Map([['action', { allowedRoles: new Set([10]) }]]),
        actionsGloballyAllowed: new Set(),
      });

      jest.useFakeTimers();
      jest.setSystemTime(0);

      const can1 = await service.can(10, 'action');
      jest.setSystemTime(options.permissionsCacheDurationInSeconds * 1000 - 1);
      const can2 = await service.can(10, 'action');

      expect(can1).toBe(true);
      expect(can2).toBe(true);

      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });

    it('should update the cache if 2 calls are made in a long time', async () => {
      const { service, options, serverInterface } = setup(
        {
          isDevelopment: false,
          actionsByRole: new Map([['action', { allowedRoles: new Set([10]) }]]),
          actionsGloballyAllowed: new Set(),
        },
        {
          isDevelopment: false,
          actionsByRole: new Map([['action', { allowedRoles: new Set([10]) }]]),
          actionsGloballyAllowed: new Set(),
        },
      );

      jest.useFakeTimers();
      jest.setSystemTime(0);

      const can1 = await service.can(10, 'action');
      jest.setSystemTime(options.permissionsCacheDurationInSeconds * 1000 + 1);
      const can2 = await service.can(10, 'action');

      expect(can1).toBe(true);
      expect(can2).toBe(true);

      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(2);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCustomActionCondition', () => {
    it('should return the custom action condition if it exists', async () => {
      const customActionCondition = {
        field: 'filed',
        operator: 'equal',
        value: 'value',
        source: 'data',
      } as RawTreeWithSources;

      const actionConditions = new Map([[10, customActionCondition]]);

      const { service, options, permissions, serverInterface } = setup({
        isDevelopment: true,
        actionsByRole: new Map([
          ['action1Identifier', { allowedRoles: new Set([]), conditionsByRole: actionConditions }],
        ]),
        actionsGloballyAllowed: new Set(),
      });

      const condition = await service.getCustomActionCondition(10, 'action1Identifier');
      expect(condition).toBe(customActionCondition);

      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(1);
      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledWith(options);

      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledWith(permissions);
    });

    it('should return undefined the custom action condition if it does not exist', async () => {
      const { service, serverInterface } = setup({
        isDevelopment: false,
        actionsByRole: new Map(),
        actionsGloballyAllowed: new Set(['action2']),
      });

      const condition = await service.getCustomActionCondition(10, 'action1Identifier');
      expect(condition).toBeUndefined();

      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });

    it('should return null if we cannot found any condition for this role', async () => {
      const { service, serverInterface } = setup({
        isDevelopment: false,
        actionsByRole: new Map(),
        actionsGloballyAllowed: new Set(['action2']),
      });

      const condition = await service.getCustomActionCondition(10, 'action1Identifier');
      expect(condition).toBeUndefined();

      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllCustomActionConditions', () => {
    it('should return all conditions for this custom action if it exists', async () => {
      const customActionCondition = {
        field: 'filed',
        operator: 'not_equal',
        value: 'value',
        source: 'data',
      } as RawTreeWithSources;

      const actionConditions = new Map([
        [42, customActionCondition],
        [43, customActionCondition],
      ]);

      const { service, options, permissions, serverInterface } = setup({
        isDevelopment: true,
        actionsByRole: new Map([
          ['action1Identifier', { allowedRoles: new Set([]), conditionsByRole: actionConditions }],
        ]),
        actionsGloballyAllowed: new Set(),
      });

      const conditions = await service.getAllCustomActionConditions('action1Identifier');
      expect(conditions).toBe(actionConditions);

      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(1);
      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledWith(options);

      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledWith(permissions);
    });

    it('should return undefined the custom action identifier does not exist', async () => {
      const { service, serverInterface } = setup({
        isDevelopment: false,
        actionsByRole: new Map(),
        actionsGloballyAllowed: new Set(),
      });

      const conditions = await service.getAllCustomActionConditions('action1Identifier');
      expect(conditions).toBeUndefined();

      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });

    it('should return undefined if we cannot found any conditions', async () => {
      const { service, serverInterface } = setup({
        isDevelopment: false,
        actionsByRole: new Map([['action1Identifier', { allowedRoles: new Set([]) }]]),
        actionsGloballyAllowed: new Set(),
      });

      const conditions = await service.getAllCustomActionConditions('action1Identifier');
      expect(conditions).toBeUndefined();

      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRoleIdsAllowedToApproveWithoutConditions', () => {
    describe('when no conditions are defined', () => {
      it('should return all role ids for this custom action if it exists', async () => {
        const { service, options, permissions, serverInterface } = setup({
          isDevelopment: true,
          actionsByRole: new Map([['action1Identifier', { allowedRoles: new Set([1, 2, 3]) }]]),
          actionsGloballyAllowed: new Set(),
        });

        const rolesIds = await service.getRoleIdsAllowedToApproveWithoutConditions(
          'action1Identifier',
        );

        expect(rolesIds).toStrictEqual([1, 2, 3]);

        expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(1);
        expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledWith(options);

        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledWith(permissions);
      });
    });

    describe('when some conditions are defined for some roles', () => {
      it('should return all role ids excluding the one with condition', async () => {
        const customActionCondition = {
          field: 'filed',
          operator: 'not_equal',
          value: 'value',
          source: 'data',
        } as RawTreeWithSources;

        const actionConditions = new Map([
          [1, customActionCondition],
          [2, customActionCondition],
        ]);

        const { service, options, permissions, serverInterface } = setup({
          isDevelopment: true,
          actionsByRole: new Map([
            [
              'action1Identifier',
              { allowedRoles: new Set([1, 2, 3]), conditionsByRole: actionConditions },
            ],
          ]),
          actionsGloballyAllowed: new Set(),
        });

        const rolesIds = await service.getRoleIdsAllowedToApproveWithoutConditions(
          'action1Identifier',
        );

        expect(rolesIds).toStrictEqual([3]);

        expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(1);
        expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledWith(options);

        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledWith(permissions);
      });
    });

    it('should return an empty array if the custom action identifier does not exist', async () => {
      const { service, serverInterface } = setup({
        isDevelopment: false,
        actionsByRole: new Map(),
        actionsGloballyAllowed: new Set(),
      });

      const rolesIds = await service.getRoleIdsAllowedToApproveWithoutConditions(
        'action1Identifier',
      );

      expect(rolesIds).toStrictEqual([]);

      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array if we cannot found any roles allowed', async () => {
      const { service, serverInterface } = setup({
        isDevelopment: false,
        actionsByRole: new Map([['action1Identifier', { allowedRoles: new Set([]) }]]),
        actionsGloballyAllowed: new Set(),
      });
      const rolesIds = await service.getRoleIdsAllowedToApproveWithoutConditions(
        'action1Identifier',
      );
      expect(rolesIds).toStrictEqual([]);

      expect(serverInterface.getEnvironmentPermissions).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });
  });
});
