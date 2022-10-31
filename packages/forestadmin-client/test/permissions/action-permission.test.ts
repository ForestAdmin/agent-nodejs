import ActionPermissionService from '../../src/permissions/action-permission';
import ForestHttpApi from '../../src/permissions/forest-http-api';
import generateActionsFromPermissions, {
  ActionPermissions,
} from '../../src/permissions/generate-actions-from-permissions';

jest.mock('../../src/permissions/forest-http-api', () => ({
  getUsers: jest.fn(),
  getEnvironmentPermissions: jest.fn(),
}));

jest.mock('../../src/permissions/generate-actions-from-permissions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const generateActionsFromPermissionsMock = generateActionsFromPermissions as jest.Mock;
const getUsersMock = ForestHttpApi.getUsers as jest.Mock;
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

    const users = [
      { id: 1, roleId: 1 },
      { id: 2, roleId: 2 },
    ];
    const permissions = { collections: {} };

    getUsersMock.mockResolvedValue(users);
    getEnvironmentPermissionsMock.mockResolvedValue(permissions);
    actionsPermissions.forEach(actionPermissions => {
      generateActionsFromPermissionsMock.mockReturnValueOnce(actionPermissions);
    });

    return { service, users, permissions, options };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('can', () => {
    it('should return true if everything is allowed', async () => {
      const { service, options, permissions, users } = setup({
        everythingAllowed: true,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(),
        actionsConditionByRoleId: new Map(),
        users: [],
      });

      const can = await service.can('1', 'action');
      expect(can).toBe(true);

      expect(getUsersMock).toHaveBeenCalledTimes(1);
      expect(getUsersMock).toHaveBeenCalledWith(options);

      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledWith(options);

      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledWith(permissions, users);
    });

    it('should return true if the action is globally allowed', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(['action']),
        actionsConditionByRoleId: new Map(),
        users: [],
      });

      const can = await service.can('1', 'action');
      expect(can).toBe(true);
    });

    it('should return true if the action is allowed for the user', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsAllowedByUser: new Map([['action', new Set(['10'])]]),
        actionsGloballyAllowed: new Set(),
        actionsConditionByRoleId: new Map(),
        users: [],
      });

      const can = await service.can('10', 'action');
      expect(can).toBe(true);
    });

    describe('when the user is not allowed in the first place', () => {
      it('should refresh the cache and return the second result', async () => {
        const { service } = setup(
          {
            everythingAllowed: false,
            actionsAllowedByUser: new Map(),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            users: [],
          },
          {
            everythingAllowed: true,
            actionsAllowedByUser: new Map([]),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            users: [],
          },
        );

        const can = await service.can('10', 'action');
        expect(can).toBe(true);

        expect(getUsersMock).toHaveBeenCalledTimes(2);
        expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });

      it('should return false if the user is still not authorized', async () => {
        const { service } = setup(
          {
            everythingAllowed: false,
            actionsAllowedByUser: new Map(),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            users: [],
          },
          {
            everythingAllowed: false,
            actionsAllowedByUser: new Map([]),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            users: [],
          },
        );

        const can = await service.can('10', 'action');
        expect(can).toBe(false);

        expect(getUsersMock).toHaveBeenCalledTimes(2);
        expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });
    });

    it('should reuse the cache if 2 calls are made in a short time', async () => {
      const { service, options } = setup({
        everythingAllowed: false,
        actionsAllowedByUser: new Map([['action', new Set(['10'])]]),
        actionsGloballyAllowed: new Set(),
        actionsConditionByRoleId: new Map(),
        users: [],
      });

      jest.useFakeTimers();
      jest.setSystemTime(0);

      const can1 = await service.can('10', 'action');
      jest.setSystemTime(options.permissionsCacheDurationInSeconds * 1000 - 1);
      const can2 = await service.can('10', 'action');

      expect(can1).toBe(true);
      expect(can2).toBe(true);

      expect(getUsersMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });

    it('should update the cache if 2 calls are made in a long time', async () => {
      const { service, options } = setup(
        {
          everythingAllowed: false,
          actionsAllowedByUser: new Map([['action', new Set(['10'])]]),
          actionsGloballyAllowed: new Set(),
          actionsConditionByRoleId: new Map(),
          users: [],
        },
        {
          everythingAllowed: false,
          actionsAllowedByUser: new Map([['action', new Set(['10'])]]),
          actionsGloballyAllowed: new Set(),
          actionsConditionByRoleId: new Map(),
          users: [],
        },
      );

      jest.useFakeTimers();
      jest.setSystemTime(0);

      const can1 = await service.can('10', 'action');
      jest.setSystemTime(options.permissionsCacheDurationInSeconds * 1000 + 1);
      const can2 = await service.can('10', 'action');

      expect(can1).toBe(true);
      expect(can2).toBe(true);

      expect(getUsersMock).toHaveBeenCalledTimes(2);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('canOneOf', () => {
    it('should return true if everything is allowed', async () => {
      const { service, options, permissions, users } = setup({
        everythingAllowed: true,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(),
        actionsConditionByRoleId: new Map(),
        users: [],
      });

      const can = await service.canOneOf('1', ['action1', 'action2']);
      expect(can).toBe(true);

      expect(getUsersMock).toHaveBeenCalledTimes(1);
      expect(getUsersMock).toHaveBeenCalledWith(options);

      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledWith(options);

      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledWith(permissions, users);
    });

    it('should return true if one of the actions is globally allowed', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(['action2']),
        actionsConditionByRoleId: new Map(),
        users: [],
      });

      const can = await service.canOneOf('1', ['action1', 'action2']);

      expect(can).toBe(true);

      expect(getUsersMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });

    it('should return true if one of the actions is allowed for the user', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsAllowedByUser: new Map([['action2', new Set(['10'])]]),
        actionsGloballyAllowed: new Set(),
        actionsConditionByRoleId: new Map(),
        users: [],
      });

      const can = await service.canOneOf('10', ['action1', 'action2']);

      expect(can).toBe(true);

      expect(getUsersMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });

    describe('when the user is not allowed in the first place', () => {
      it('should refresh the cache and return the second result', async () => {
        const { service } = setup(
          {
            everythingAllowed: false,
            actionsAllowedByUser: new Map(),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            users: [],
          },
          {
            everythingAllowed: true,
            actionsAllowedByUser: new Map([]),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            users: [],
          },
        );

        const can = await service.canOneOf('10', ['action1', 'action2']);
        expect(can).toBe(true);

        expect(getUsersMock).toHaveBeenCalledTimes(2);
        expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });

      it('should return false if the user is still not authorized', async () => {
        const { service } = setup(
          {
            everythingAllowed: false,
            actionsAllowedByUser: new Map(),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            users: [],
          },
          {
            everythingAllowed: false,
            actionsAllowedByUser: new Map([]),
            actionsGloballyAllowed: new Set(),
            actionsConditionByRoleId: new Map(),
            users: [],
          },
        );

        const can = await service.canOneOf('10', ['action1', 'action2']);

        expect(can).toBe(false);

        expect(getUsersMock).toHaveBeenCalledTimes(2);
        expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });
    });
  });
});
