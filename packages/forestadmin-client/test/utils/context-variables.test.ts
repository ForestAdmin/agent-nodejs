import { PermissionLevel } from '../../src/permissions/types';
import ContextVariables from '../../src/utils/context-variables';

describe('ContextVariables', () => {
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
  const contextVariables = new ContextVariables({
    requestContextVariables: {
      'siths.selectedRecord.power': 'electrocute',
      'siths.selectedRecord.rank': 3,
    },
    user,
    team,
  });

  describe('getValue', () => {
    describe('with a request context variable', () => {
      test('it should return the value', () => {
        expect(contextVariables.getValue('siths.selectedRecord.power')).toStrictEqual(
          'electrocute',
        );
        expect(contextVariables.getValue('siths.selectedRecord.rank')).toStrictEqual(3);
      });
    });

    describe('with a currentUser variable', () => {
      test('it should return the value form the current user', () => {
        [
          { key: 'email', expectedValue: user.email },
          { key: 'firstName', expectedValue: user.firstName },
          { key: 'lastName', expectedValue: user.lastName },
          { key: 'fullName', expectedValue: user.fullName },
          { key: 'id', expectedValue: user.id },
          { key: 'permissionLevel', expectedValue: user.permissionLevel },
          { key: 'roleId', expectedValue: user.roleId },
          { key: 'tags.planet', expectedValue: user.tags.planet },
          { key: 'team.id', expectedValue: team.id },
          { key: 'team.name', expectedValue: team.name },
        ].forEach(({ key, expectedValue }) => {
          expect(contextVariables.getValue(`currentUser.${key}`)).toStrictEqual(expectedValue);
        });
      });
    });
  });
});
