import type { EnvironmentPermissionsV4 } from '@forestadmin/forestadmin-client';

import {
  CollectionActionEvent,
  CustomActionEvent,
  generateActionsFromPermissions,
} from '@forestadmin/forestadmin-client';

import {
  canRolePerformCollectionAction,
  canRolePerformCustomAction,
  isActionIdentifierAllowedForRole,
} from '../../src/permissions/can-role-perform';

const ADMIN_ROLE = 1;
const VIEWER_ROLE = 2;

function crud(overrides: Record<string, unknown> = {}) {
  return {
    browseEnabled: { roles: [ADMIN_ROLE] },
    readEnabled: { roles: [ADMIN_ROLE] },
    editEnabled: { roles: [ADMIN_ROLE] },
    addEnabled: { roles: [ADMIN_ROLE] },
    deleteEnabled: { roles: [ADMIN_ROLE] },
    exportEnabled: { roles: [ADMIN_ROLE] },
    ...overrides,
  };
}

function smartAction(overrides: Record<string, unknown> = {}) {
  return {
    triggerEnabled: { roles: [ADMIN_ROLE] },
    triggerConditions: [],
    approvalRequired: { roles: [ADMIN_ROLE] },
    approvalRequiredConditions: [],
    userApprovalEnabled: { roles: [ADMIN_ROLE] },
    userApprovalConditions: [],
    selfApprovalEnabled: { roles: [ADMIN_ROLE] },
    ...overrides,
  };
}

const NORMAL_MODE = {
  collections: {
    users: { collection: crud(), actions: { 'Block user': smartAction() } },
  },
} as unknown as EnvironmentPermissionsV4;

describe('isActionIdentifierAllowedForRole', () => {
  describe('when the environment is in development', () => {
    it('should allow an action no descriptor mentions', () => {
      expect(
        isActionIdentifierAllowedForRole(
          generateActionsFromPermissions(true),
          VIEWER_ROLE,
          'anything',
        ),
      ).toBe(true);
    });
  });

  describe('when the identifier is absent from the permissions', () => {
    it('should deny rather than throw', () => {
      expect(
        isActionIdentifierAllowedForRole(
          generateActionsFromPermissions(NORMAL_MODE),
          ADMIN_ROLE,
          'collection:ghost:browse',
        ),
      ).toBe(false);
    });
  });
});

describe('canRolePerformCollectionAction', () => {
  describe('when the action is globally allowed', () => {
    it('should allow a role the descriptor never named', () => {
      const permissions = generateActionsFromPermissions({
        collections: {
          users: { collection: crud({ browseEnabled: true }), actions: {} },
        },
      } as unknown as EnvironmentPermissionsV4);

      expect(
        canRolePerformCollectionAction(
          permissions,
          VIEWER_ROLE,
          CollectionActionEvent.Browse,
          'users',
        ),
      ).toBe(true);
    });
  });

  describe('when the action is restricted to roles', () => {
    it.each([
      ['the named role', ADMIN_ROLE, true],
      ['a role mismatch', VIEWER_ROLE, false],
    ])('should resolve %s to %s', (_label, roleId, expected) => {
      expect(
        canRolePerformCollectionAction(
          generateActionsFromPermissions(NORMAL_MODE),
          roleId as number,
          CollectionActionEvent.Read,
          'users',
        ),
      ).toBe(expected);
    });
  });
});

describe('canRolePerformCustomAction', () => {
  describe('when the custom action is restricted to roles', () => {
    it.each([
      ['the named role', ADMIN_ROLE, true],
      ['a role mismatch', VIEWER_ROLE, false],
    ])('should resolve %s to %s', (_label, roleId, expected) => {
      expect(
        canRolePerformCustomAction({
          permissions: generateActionsFromPermissions(NORMAL_MODE),
          roleId: roleId as number,
          event: CustomActionEvent.Trigger,
          actionName: 'Block user',
          collectionName: 'users',
        }),
      ).toBe(expected);
    });
  });
});
