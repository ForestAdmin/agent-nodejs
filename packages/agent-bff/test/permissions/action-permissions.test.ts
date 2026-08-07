import type { EnvironmentPermissionsV4 } from '@forestadmin/forestadmin-client';

import {
  CollectionActionEvent,
  CustomActionEvent,
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from '../../src/permissions/action-identifiers';
import {
  buildActionPermissions,
  canRolePerformCollectionAction,
  canRolePerformCustomAction,
  isActionIdentifierAllowedForRole,
} from '../../src/permissions/action-permissions';

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

describe('buildActionPermissions', () => {
  describe('when the environment permissions are literally true', () => {
    it('should flag development and return empty collections', () => {
      expect(buildActionPermissions(true)).toEqual({
        isDevelopment: true,
        actionsGloballyAllowed: new Set(),
        actionsByRole: new Map(),
      });
    });
  });

  describe('when a right is granted to every role', () => {
    it('should place the identifier in actionsGloballyAllowed rather than keying it by role', () => {
      const permissions = buildActionPermissions({
        collections: {
          users: { collection: crud({ browseEnabled: true }), actions: {} },
        },
      } as unknown as EnvironmentPermissionsV4);
      const browse = generateCollectionActionIdentifier(CollectionActionEvent.Browse, 'users');

      expect(permissions.actionsGloballyAllowed.has(browse)).toBe(true);
      expect(permissions.actionsByRole.has(browse)).toBe(false);
    });
  });

  describe('when a right is granted to specific roles', () => {
    it('should key the identifier by those roles', () => {
      const permissions = buildActionPermissions(NORMAL_MODE);
      const read = generateCollectionActionIdentifier(CollectionActionEvent.Read, 'users');

      expect(permissions.actionsByRole.get(read)?.allowedRoles).toEqual(new Set([ADMIN_ROLE]));
    });
  });

  describe('when a right carries conditions', () => {
    it('should map them by role id', () => {
      const filter = { field: 'id', operator: 'equal', value: 1 };
      const permissions = buildActionPermissions({
        collections: {
          users: {
            collection: crud(),
            actions: {
              'Block user': smartAction({
                triggerConditions: [{ roleId: VIEWER_ROLE, filter }],
              }),
            },
          },
        },
      } as unknown as EnvironmentPermissionsV4);
      const trigger = generateCustomActionIdentifier(
        CustomActionEvent.Trigger,
        'Block user',
        'users',
      );

      expect(permissions.actionsByRole.get(trigger)?.conditionsByRole).toEqual(
        new Map([[VIEWER_ROLE, filter]]),
      );
    });
  });

  describe('when a right is denied to everyone', () => {
    it('should expose it in neither collection', () => {
      const permissions = buildActionPermissions({
        collections: {
          users: { collection: crud({ deleteEnabled: false }), actions: {} },
        },
      } as unknown as EnvironmentPermissionsV4);
      const remove = generateCollectionActionIdentifier(CollectionActionEvent.Delete, 'users');

      expect(permissions.actionsGloballyAllowed.has(remove)).toBe(false);
      expect(permissions.actionsByRole.has(remove)).toBe(false);
    });
  });
});

describe('isActionIdentifierAllowedForRole', () => {
  describe('when the environment is in development', () => {
    it('should allow an action no descriptor mentions', () => {
      expect(
        isActionIdentifierAllowedForRole(buildActionPermissions(true), VIEWER_ROLE, 'anything'),
      ).toBe(true);
    });
  });

  describe('when the action is globally allowed', () => {
    it('should allow a role the descriptor never named', () => {
      const permissions = buildActionPermissions({
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
          buildActionPermissions(NORMAL_MODE),
          roleId as number,
          CollectionActionEvent.Read,
          'users',
        ),
      ).toBe(expected);
    });
  });

  describe('when the identifier is absent from the permissions', () => {
    it('should deny rather than throw', () => {
      expect(
        isActionIdentifierAllowedForRole(
          buildActionPermissions(NORMAL_MODE),
          ADMIN_ROLE,
          'collection:ghost:browse',
        ),
      ).toBe(false);
    });
  });

  it.each([
    [CollectionActionEvent.Browse],
    [CollectionActionEvent.Read],
    [CollectionActionEvent.Edit],
    [CollectionActionEvent.Add],
    [CollectionActionEvent.Delete],
    [CollectionActionEvent.Export],
  ])('should resolve the %s collection right for the named role', action => {
    expect(
      canRolePerformCollectionAction(
        buildActionPermissions(NORMAL_MODE),
        ADMIN_ROLE,
        action,
        'users',
      ),
    ).toBe(true);
  });

  it.each([
    [CustomActionEvent.Trigger],
    [CustomActionEvent.Approve],
    [CustomActionEvent.SelfApprove],
    [CustomActionEvent.RequireApproval],
  ])('should resolve the %s custom-action event for the named role', event => {
    expect(
      canRolePerformCustomAction({
        permissions: buildActionPermissions(NORMAL_MODE),
        roleId: ADMIN_ROLE,
        event,
        actionName: 'Block user',
        collectionName: 'users',
      }),
    ).toBe(true);
  });

  describe('when an action-event flag is missing from the payload', () => {
    it('should throw rather than invent a denial', () => {
      const { selfApprovalEnabled, ...withoutSelfApproval } = smartAction();

      expect(selfApprovalEnabled).toBeDefined();
      expect(() =>
        buildActionPermissions({
          collections: {
            users: { collection: crud(), actions: { 'Block user': withoutSelfApproval } },
          },
        } as unknown as EnvironmentPermissionsV4),
      ).toThrow(TypeError);
    });
  });

  describe('when a CRUD descriptor is missing from the payload', () => {
    it('should throw rather than invent a denial', () => {
      const { deleteEnabled, ...withoutDelete } = crud();

      expect(deleteEnabled).toBeDefined();
      expect(() =>
        buildActionPermissions({
          collections: { users: { collection: withoutDelete, actions: {} } },
        } as unknown as EnvironmentPermissionsV4),
      ).toThrow(TypeError);
    });
  });
});

describe('identifier builders', () => {
  it('should build a collection-action identifier', () => {
    expect(generateCollectionActionIdentifier(CollectionActionEvent.Browse, 'users')).toBe(
      'collection:users:browse',
    );
  });

  it('should build a custom-action identifier', () => {
    expect(
      generateCustomActionIdentifier(CustomActionEvent.RequireApproval, 'Block user', 'users'),
    ).toBe('custom:users:Block user:require-approval');
  });
});
