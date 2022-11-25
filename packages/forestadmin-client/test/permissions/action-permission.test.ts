import ActionPermissionService from '../../src/permissions/action-permission';
import ForestHttpApi from '../../src/permissions/forest-http-api';
import generateActionsFromPermissions, {
  ActionPermissions,
} from '../../src/permissions/generate-actions-from-permissions';
import { RawTreeWithSources, UserPermissionV4 } from '../../src/permissions/types';

jest.mock('../../src/permissions/forest-http-api', () => ({
  getEnvironmentPermissions: jest.fn(),
}));

jest.mock('../../src/permissions/generate-actions-from-permissions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const generateActionsFromPermissionsMock = generateActionsFromPermissions as jest.Mock;
const getEnvironmentPermissionsMock = ForestHttpApi.getEnvironmentPermissions as jest.Mock;

describe('ActionPermissionService', () => {
  function setup(...actionsPermissions: ActionPermissions[]) {
    const options = {
      permissionsCacheDurationInSeconds: 1,
      envSecret: '123',
      forestServerUrl: 'http://api',
      isProduction: true,
      logger: jest.fn(),
    };
    const service = new ActionPermissionService(options);

    const permissions = { collections: {} };

    getEnvironmentPermissionsMock.mockResolvedValue(permissions);
    actionsPermissions.forEach(actionPermissions => {
      generateActionsFromPermissionsMock.mockReturnValueOnce(actionPermissions);
    });

    return { service, permissions, options };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('can', () => {
    it('should return true if everything is allowed', async () => {
      const { service, options, permissions } = setup({
        everythingAllowed: true,
        actionsByRole: new Map(),
        actionsGloballyAllowed: new Set(),
        actionsConditionByRoleId: new Map(),
        actionsRawRights: {},
        allRoleIds: [],
        users: [],
      });

      const can = await service.can(1, 'action');
      expect(can).toBe(true);

      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledWith(options);

      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledWith(permissions);
    });

    it('should return true if the action is globally allowed', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsByRole: new Map(),
        actionsGloballyAllowed: new Set(['action']),
        actionsConditionByRoleId: new Map(),
        actionsRawRights: {},
        allRoleIds: [],
        users: [],
      });

      const can = await service.can(1, 'action');
      expect(can).toBe(true);
    });

    it('should return true if the action is allowed for the user', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsByRole: new Map([['action', { allowedRoles: new Set([10]) }]]),
        actionsGloballyAllowed: new Set(),
        actionsConditionByRoleId: new Map(),
        actionsRawRights: {},
        allRoleIds: [],
        users: [],
      });

      const can = await service.can(10, 'action');
      expect(can).toBe(true);
    });

    describe('when the user is not allowed in the first place', () => {
      it('should refresh the cache and return the second result', async () => {
        const { service } = setup(
          {
            everythingAllowed: false,
            actionsByRole: new Map(),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            actionsRawRights: {},
            allRoleIds: [],
            users: [],
          },
          {
            everythingAllowed: true,
            actionsByRole: new Map([]),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            actionsRawRights: {},
            allRoleIds: [],
            users: [],
          },
        );

        const can = await service.can(10, 'action');
        expect(can).toBe(true);

        expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });

      it('should return false if the user is still not authorized', async () => {
        const { service } = setup(
          {
            everythingAllowed: false,
            actionsByRole: new Map(),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            actionsRawRights: {},
            allRoleIds: [],
            users: [],
          },
          {
            everythingAllowed: false,
            actionsByRole: new Map([]),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            actionsRawRights: {},
            allRoleIds: [],
            users: [],
          },
        );

        const can = await service.can(10, 'action');
        expect(can).toBe(false);

        expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });
    });

    it('should reuse the cache if 2 calls are made in a short time', async () => {
      const { service, options } = setup({
        everythingAllowed: false,
        actionsByRole: new Map([['action', { allowedRoles: new Set([10]) }]]),
        actionsGloballyAllowed: new Set(),
        actionsConditionByRoleId: new Map(),
        actionsRawRights: {},
        allRoleIds: [],
        users: [],
      });

      jest.useFakeTimers();
      jest.setSystemTime(0);

      const can1 = await service.can(10, 'action');
      jest.setSystemTime(options.permissionsCacheDurationInSeconds * 1000 - 1);
      const can2 = await service.can(10, 'action');

      expect(can1).toBe(true);
      expect(can2).toBe(true);

      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });

    it('should update the cache if 2 calls are made in a long time', async () => {
      const { service, options } = setup(
        {
          everythingAllowed: false,
          actionsByRole: new Map([['action', { allowedRoles: new Set([10]) }]]),
          actionsGloballyAllowed: new Set(),
          actionsConditionByRoleId: new Map(),
          actionsRawRights: {},
          allRoleIds: [],
          users: [],
        },
        {
          everythingAllowed: false,
          actionsByRole: new Map([['action', { allowedRoles: new Set([10]) }]]),
          actionsGloballyAllowed: new Set(),
          actionsConditionByRoleId: new Map(),
          actionsRawRights: {},
          allRoleIds: [],
          users: [],
        },
      );

      jest.useFakeTimers();
      jest.setSystemTime(0);

      const can1 = await service.can(10, 'action');
      jest.setSystemTime(options.permissionsCacheDurationInSeconds * 1000 + 1);
      const can2 = await service.can(10, 'action');

      expect(can1).toBe(true);
      expect(can2).toBe(true);

      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('canOneOf', () => {
    it('should return true if everything is allowed', async () => {
      const { service, options, permissions } = setup({
        everythingAllowed: true,
        actionsByRole: new Map(),
        actionsGloballyAllowed: new Set(),
        actionsConditionByRoleId: new Map(),
        actionsRawRights: {},
        allRoleIds: [],
        users: [],
      });

      const can = await service.canOneOf(1, ['action1', 'action2']);
      expect(can).toBe(true);

      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledWith(options);

      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledWith(permissions);
    });

    it('should return true if one of the actions is globally allowed', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsByRole: new Map(),
        actionsGloballyAllowed: new Set(['action2']),
        actionsConditionByRoleId: new Map(),
        actionsRawRights: {},
        allRoleIds: [],
        users: [],
      });

      const can = await service.canOneOf(1, ['action1', 'action2']);

      expect(can).toBe(true);

      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });

    it('should return true if one of the actions is allowed for the user', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsByRole: new Map([['action2', { allowedRoles: new Set([10]) }]]),
        actionsGloballyAllowed: new Set(),
        actionsConditionByRoleId: new Map(),
        actionsRawRights: {},
        allRoleIds: [],
        users: [],
      });

      const can = await service.canOneOf(10, ['action1', 'action2']);

      expect(can).toBe(true);

      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });

    describe('when the user is not allowed in the first place', () => {
      it('should refresh the cache and return the second result', async () => {
        const { service } = setup(
          {
            everythingAllowed: false,
            actionsByRole: new Map(),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            actionsRawRights: {},
            allRoleIds: [],
            users: [],
          },
          {
            everythingAllowed: true,
            actionsByRole: new Map([]),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            actionsRawRights: {},
            allRoleIds: [],
            users: [],
          },
        );

        const can = await service.canOneOf(10, ['action1', 'action2']);
        expect(can).toBe(true);

        expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });

      it('should return false if the user is still not authorized', async () => {
        const { service } = setup(
          {
            everythingAllowed: false,
            actionsByRole: new Map(),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            actionsRawRights: {},
            allRoleIds: [],
            users: [],
          },
          {
            everythingAllowed: false,
            actionsByRole: new Map([]),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            actionsRawRights: {},
            allRoleIds: [],
            users: [],
          },
        );

        const can = await service.canOneOf(10, ['action1', 'action2']);

        expect(can).toBe(false);

        expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('getCustomActionConditionForUser', () => {
    it('should return the custom action condition if it exists', async () => {
      const customActionCondition = {
        field: 'filed',
        operator: 'equal',
        value: 'value',
        source: 'data',
      } as RawTreeWithSources;

      const { service, options, permissions, users } = setup({
        everythingAllowed: true,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(),
        actionsConditionByRoleId: new Map([
          ['action1Identifier', new Map([[42, customActionCondition]])],
        ]),
        actionsRawRights: {},
        allRoleIds: [],
        users: [{ id: 1, roleId: 42 } as UserPermissionV4],
      });

      const condition = await service.getCustomActionConditionForUser('1', 'action1Identifier');
      expect(condition).toBe(customActionCondition);

      expect(getUsersMock).toHaveBeenCalledTimes(1);
      expect(getUsersMock).toHaveBeenCalledWith(options);

      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledWith(options);

      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledWith(permissions, users);
    });

    it('should return null the custom action condition if it does not exist', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(['action2']),
        actionsConditionByRoleId: new Map(),
        actionsRawRights: {},
        allRoleIds: [],
        users: [],
      });

      const condition = await service.getCustomActionConditionForUser('1', 'action1Identifier');
      expect(condition).toBeUndefined();

      expect(getUsersMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });

    it('should return null if we cannot found any condition for this role', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(['action2']),
        actionsConditionByRoleId: new Map([['action1Identifier', new Map()]]),
        actionsRawRights: {},
        allRoleIds: [],
        users: [{ id: 1, roleId: 42 } as UserPermissionV4],
      });

      const condition = await service.getCustomActionConditionForUser('1', 'action1Identifier');
      expect(condition).toBeUndefined();

      expect(getUsersMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
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

      const { service, options, permissions, users } = setup({
        everythingAllowed: true,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(),
        actionsConditionByRoleId: new Map([['action1Identifier', actionConditions]]),
        actionsRawRights: {},
        allRoleIds: [],
        users: [{ id: 1, roleId: 42 } as UserPermissionV4],
      });

      const conditions = await service.getAllCustomActionConditions('action1Identifier');
      expect(conditions).toBe(actionConditions);

      expect(getUsersMock).toHaveBeenCalledTimes(1);
      expect(getUsersMock).toHaveBeenCalledWith(options);

      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledWith(options);

      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledWith(permissions, users);
    });

    it('should return null the custom action identifier does not exist', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(['action2']),
        actionsConditionByRoleId: new Map(),
        actionsRawRights: {},
        allRoleIds: [],
        users: [],
      });

      const conditions = await service.getAllCustomActionConditions('action1Identifier');
      expect(conditions).toBeUndefined();

      expect(getUsersMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });

    it('should return empty map if we cannot found any conditions', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(['action2']),
        actionsConditionByRoleId: new Map([['action1Identifier', new Map()]]),
        actionsRawRights: {},
        allRoleIds: [],
        users: [{ id: 1, roleId: 42 } as UserPermissionV4],
      });

      const condition = await service.getAllCustomActionConditions('action1Identifier');
      expect(condition).toEqual(new Map());

      expect(getUsersMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });
  });
});
