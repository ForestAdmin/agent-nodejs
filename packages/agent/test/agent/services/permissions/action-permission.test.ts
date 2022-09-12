import ActionPermissionService from '../../../../src/agent/services/permissions/action-permission';
import ForestHttpApi from '../../../../src/agent/utils/forest-http-api';
import generateActionsFromPermissions, {
  ActionPermissions,
} from '../../../../src/agent/utils/generate-actions-from-permissions';

jest.mock('../../../../src/agent/utils/forest-http-api', () => ({
  getRoles: jest.fn(),
  getEnvironmentPermissions: jest.fn(),
}));

jest.mock('../../../../src/agent/utils/generate-actions-from-permissions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const generateActionsFromPermissionsMock = generateActionsFromPermissions as jest.Mock;
const getRolesMock = ForestHttpApi.getRoles as jest.Mock;
const getEnvironmentPermissionsMock = ForestHttpApi.getEnvironmentPermissions as jest.Mock;

describe('ActionPermissionService', () => {
  function setup(...actionsPermissions: ActionPermissions[]) {
    const options = {
      permissionsCacheDurationInSeconds: 1,
      envSecret: '123',
      forestServerUrl: 'http://api',
      isProduction: true,
    };
    const service = new ActionPermissionService(options);

    const roles = [{ id: 1, name: 'Admin', users: [1, 2] }];
    const permissions = { collections: {} };

    getRolesMock.mockResolvedValue(roles);
    getEnvironmentPermissionsMock.mockResolvedValue(permissions);
    actionsPermissions.forEach(actionPermissions => {
      generateActionsFromPermissionsMock.mockReturnValueOnce(actionPermissions);
    });

    return { service, roles, permissions, options };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('can', () => {
    it('should return true if everything is allowed', async () => {
      const { service, options, permissions, roles } = setup({
        everythingAllowed: true,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(),
      });

      const can = await service.can({ userId: '1', renderingId: '1', actionName: 'action' });
      expect(can).toBe(true);

      expect(getRolesMock).toHaveBeenCalledTimes(1);
      expect(getRolesMock).toHaveBeenCalledWith(options);

      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledWith(options);

      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledWith(permissions, roles);
    });

    it('should return true if the action is globally allowed', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(['action']),
      });

      const can = await service.can({ userId: '1', renderingId: '1', actionName: 'action' });
      expect(can).toBe(true);
    });

    it('should return true if the action is allowed for the user', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsAllowedByUser: new Map([['action', new Set(['10'])]]),
        actionsGloballyAllowed: new Set(),
      });

      const can = await service.can({ userId: '10', renderingId: '1', actionName: 'action' });
      expect(can).toBe(true);
    });

    describe('when the user is not allowed in the first place', () => {
      it('should refresh the cache and return the second result', async () => {
        const { service } = setup(
          {
            everythingAllowed: false,
            actionsAllowedByUser: new Map(),
            actionsGloballyAllowed: new Set(),
          },
          {
            everythingAllowed: true,
            actionsAllowedByUser: new Map([]),
            actionsGloballyAllowed: new Set(),
          },
        );

        const can = await service.can({ userId: '10', renderingId: '1', actionName: 'action' });
        expect(can).toBe(true);

        expect(getRolesMock).toHaveBeenCalledTimes(2);
        expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });

      it('should return false if the user is still not authorized', async () => {
        const { service } = setup(
          {
            everythingAllowed: false,
            actionsAllowedByUser: new Map(),
            actionsGloballyAllowed: new Set(),
          },
          {
            everythingAllowed: false,
            actionsAllowedByUser: new Map([]),
            actionsGloballyAllowed: new Set(),
          },
        );

        const can = await service.can({ userId: '10', renderingId: '1', actionName: 'action' });
        expect(can).toBe(false);

        expect(getRolesMock).toHaveBeenCalledTimes(2);
        expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('canOneOf', () => {
    it('should return true if everything is allowed', async () => {
      const { service, options, permissions, roles } = setup({
        everythingAllowed: true,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(),
      });

      const can = await service.canOneOf({
        userId: '1',
        renderingId: '1',
        actionNames: ['action1', 'action2'],
      });
      expect(can).toBe(true);

      expect(getRolesMock).toHaveBeenCalledTimes(1);
      expect(getRolesMock).toHaveBeenCalledWith(options);

      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledWith(options);

      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledWith(permissions, roles);
    });

    it('should return true if one of the actions is globally allowed', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsAllowedByUser: new Map(),
        actionsGloballyAllowed: new Set(['action2']),
      });

      const can = await service.canOneOf({
        userId: '1',
        renderingId: '1',
        actionNames: ['action1', 'action2'],
      });

      expect(can).toBe(true);

      expect(getRolesMock).toHaveBeenCalledTimes(1);
      expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(1);
      expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(1);
    });

    it('should return true if one of the actions is allowed for the user', async () => {
      const { service } = setup({
        everythingAllowed: false,
        actionsAllowedByUser: new Map([['action2', new Set(['10'])]]),
        actionsGloballyAllowed: new Set(),
      });

      const can = await service.canOneOf({
        userId: '10',
        renderingId: '1',
        actionNames: ['action1', 'action2'],
      });

      expect(can).toBe(true);

      expect(getRolesMock).toHaveBeenCalledTimes(1);
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
          },
          {
            everythingAllowed: true,
            actionsAllowedByUser: new Map([]),
            actionsGloballyAllowed: new Set(),
          },
        );

        const can = await service.canOneOf({
          userId: '10',
          renderingId: '1',
          actionNames: ['action1', 'action2'],
        });
        expect(can).toBe(true);

        expect(getRolesMock).toHaveBeenCalledTimes(2);
        expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });

      it('should return false if the user is still not authorized', async () => {
        const { service } = setup(
          {
            everythingAllowed: false,
            actionsAllowedByUser: new Map(),
            actionsGloballyAllowed: new Set(),
          },
          {
            everythingAllowed: false,
            actionsAllowedByUser: new Map([]),
            actionsGloballyAllowed: new Set(),
          },
        );

        const can = await service.canOneOf({
          userId: '10',
          renderingId: '1',
          actionNames: ['action1', 'action2'],
        });

        expect(can).toBe(false);

        expect(getRolesMock).toHaveBeenCalledTimes(2);
        expect(getEnvironmentPermissionsMock).toHaveBeenCalledTimes(2);
        expect(generateActionsFromPermissionsMock).toHaveBeenCalledTimes(2);
      });
    });
  });
});
