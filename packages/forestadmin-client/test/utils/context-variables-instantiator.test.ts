import { hashServerCharts } from '../../src/permissions/hash-chart';
import ContextVariablesInstantiator from '../../src/utils/context-variables-instantiator';
import renderingPermissionsFactory from '../__factories__/permissions/rendering-permission';

jest.mock('../../src/permissions/forest-http-api', () => ({
  getRenderingPermissions: jest.fn(),
}));

jest.mock('../../src/permissions/hash-chart', () => ({
  __esModule: true,
  hashServerCharts: jest.fn(),
}));

describe('ContextVariablesInstantiator', () => {
  function setup() {
    const userInfo = {
      id: 42,
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'janedoe@forestadmin.com',
      permissionLevel: 'Admin',
      tags: {},
      roleId: 33,
    };
    const teamInfo = {
      name: 'Team 1',
      id: 29,
    };
    const renderingPermissionsService = renderingPermissionsFactory.mockAllMethods().build();
    const hashServerChartsMock = hashServerCharts as jest.Mock;

    const getUserMock = renderingPermissionsService.getUser as jest.Mock;
    const getTeamMock = renderingPermissionsService.getTeam as jest.Mock;
    hashServerChartsMock.mockReturnValue(new Set(['HASH']));

    const contextVariablesInstantiator = new ContextVariablesInstantiator(
      renderingPermissionsService,
    );

    getTeamMock.mockResolvedValueOnce(teamInfo);
    getUserMock.mockResolvedValueOnce(userInfo);

    return contextVariablesInstantiator;
  }

  describe('buildContextVariables', () => {
    describe('with a context variable', () => {
      test('it should return it as it is', async () => {
        const contextVariablesInstantiator = setup();

        const requestContextVariables = {
          'siths.selectedRecord.power': 'electrocute',
        };
        const renderingId = 20;
        const userId = 10;

        const contextVariables = await contextVariablesInstantiator.buildContextVariables({
          requestContextVariables,
          renderingId,
          userId,
        });

        expect(contextVariables.getValue('siths.selectedRecord.power')).toBe('electrocute');
        expect(contextVariables.getValue('currentUser.id')).toBe(42);
        expect(contextVariables.getValue('currentUser.team.id')).toBe(29);
      });
    });
  });
});
