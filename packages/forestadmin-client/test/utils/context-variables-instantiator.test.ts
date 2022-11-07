import { PermissionLevel } from '../../src/permissions/types';
import ContextVariables from '../../src/utils/context-variables';
import ContextVariablesInstantiator from '../../src/utils/context-variables-instantiator';
import renderingPermissionsFactory from '../__factories__/permissions/rendering-permission';

describe('ContextVariablesInjector', () => {
  describe('buildContextVariables', () => {
    test('it should return a ContextVariables', async () => {
      const team = { id: 100, name: 'Ninja' };
      const user = {
        email: 'john.doe@forestadmin.com',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        id: 12,
        permissionLevel: PermissionLevel.Admin,
        roleId: 13,
        tags: { planet: 'Death Star' },
      };
      const renderingPermissionService = renderingPermissionsFactory.mockAllMethods().build();
      const getUserMock = renderingPermissionService.getUser as jest.Mock;
      const getTeamMock = renderingPermissionService.getTeam as jest.Mock;
      getUserMock.mockReturnValue(user);
      getTeamMock.mockReturnValue(team);

      const contextVariablesInstantiator = new ContextVariablesInstantiator(
        renderingPermissionService,
      );

      const requestContextVariables = { 'collection.selectedRecord.id': 123 };
      const renderingId = 11;
      const userId = 13;

      const contextVariables = await contextVariablesInstantiator.buildContextVariables({
        requestContextVariables,
        renderingId,
        userId,
      });

      expect(contextVariables).toBeInstanceOf(ContextVariables);
      expect(getTeamMock).toHaveBeenCalledWith(renderingId);
      expect(getUserMock).toHaveBeenCalledWith(userId);

      expect(contextVariables.getValue('collection.selectedRecord.id')).toBe(123);
      expect(contextVariables.getValue('currentUser.team.name')).toBe('Ninja');
      expect(contextVariables.getValue('currentUser.fullName')).toBe('John Doe');
    });
  });
});
