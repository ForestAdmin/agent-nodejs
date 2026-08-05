import type ReadModel from '../../src/read-model/read-model';
import type { EnvironmentPermissionsV4 } from '@forestadmin/forestadmin-client';

import buildPermissionHints, {
  DISPLAY_HINT_FINALITY,
} from '../../src/permissions/build-permission-hints';

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

function readModelStub(actionsByCollection: Record<string, string[]>): ReadModel {
  const endpoints: Record<string, Record<string, unknown>> = {};

  for (const [collection, actions] of Object.entries(actionsByCollection)) {
    endpoints[collection] = {};
    for (const action of actions) endpoints[collection][action] = { name: action };
  }

  return {
    getActionEndpoints: () => endpoints,
    isCollectionAllowed: (collection: string) => collection in actionsByCollection,
    getAllowedCollections: () => Object.keys(actionsByCollection),
  } as unknown as ReadModel;
}

describe('buildPermissionHints', () => {
  describe('when the environment is in development mode', () => {
    it('should return every CRUD hint true and every approval hint false', () => {
      const hints = buildPermissionHints({
        environmentPermissions: true,
        roleId: VIEWER_ROLE,
        readModel: readModelStub({ users: ['Block user'] }),
        collections: ['users'],
      });

      expect(hints.collections.users.crud).toEqual({
        browse: true,
        read: true,
        edit: true,
        add: true,
        delete: true,
        export: true,
      });
      expect(hints.collections.users.actions['users.Block user']).toEqual({
        collection: 'users',
        name: 'Block user',
        qualifiedName: 'users.Block user',
        visible: true,
        requiresApprovalHint: false,
        canApproveHint: false,
        canSelfApproveHint: false,
        finality: DISPLAY_HINT_FINALITY,
      });
    });
  });

  describe('when the caller role holds every descriptor in normal mode', () => {
    it('should return CRUD, visibility and approval hints computed from the descriptors', () => {
      const hints = buildPermissionHints({
        environmentPermissions: NORMAL_MODE,
        roleId: ADMIN_ROLE,
        readModel: readModelStub({ users: ['Block user'] }),
        collections: ['users'],
      });

      expect(hints.collections.users.crud).toEqual({
        browse: true,
        read: true,
        edit: true,
        add: true,
        delete: true,
        export: true,
      });
      expect(hints.collections.users.actions['users.Block user']).toMatchObject({
        visible: true,
        requiresApprovalHint: true,
        canApproveHint: true,
        canSelfApproveHint: true,
      });
      expect(hints.visibleActions).toEqual(['users.Block user']);
    });
  });

  describe('when the caller role holds no descriptor in normal mode', () => {
    it('should return every hint false and omit the action from visibleActions', () => {
      const hints = buildPermissionHints({
        environmentPermissions: NORMAL_MODE,
        roleId: VIEWER_ROLE,
        readModel: readModelStub({ users: ['Block user'] }),
        collections: ['users'],
      });

      expect(hints.collections.users.crud).toEqual({
        browse: false,
        read: false,
        edit: false,
        add: false,
        delete: false,
        export: false,
      });
      expect(hints.collections.users.actions['users.Block user']).toMatchObject({
        visible: false,
        requiresApprovalHint: false,
        canApproveHint: false,
        canSelfApproveHint: false,
      });
      expect(hints.visibleActions).toEqual([]);
    });
  });

  describe('when a CRUD descriptor grants no role', () => {
    it('should default that CRUD hint to false', () => {
      const permissions = {
        collections: {
          users: {
            collection: crud({ readEnabled: { roles: [] }, exportEnabled: false }),
            actions: {},
          },
        },
      } as unknown as EnvironmentPermissionsV4;

      const hints = buildPermissionHints({
        environmentPermissions: permissions,
        roleId: ADMIN_ROLE,
        readModel: readModelStub({ users: [] }),
        collections: ['users'],
      });

      expect(hints.collections.users.crud).toEqual({
        browse: true,
        read: false,
        edit: true,
        add: true,
        delete: true,
        export: false,
      });
    });
  });

  describe('when a collection is absent from the permission payload entirely', () => {
    it('should return every CRUD hint false rather than throwing', () => {
      const hints = buildPermissionHints({
        environmentPermissions: NORMAL_MODE,
        roleId: ADMIN_ROLE,
        readModel: readModelStub({ ghosts: [] }),
        collections: ['ghosts'],
      });

      expect(hints.collections.ghosts.crud).toEqual({
        browse: false,
        read: false,
        edit: false,
        add: false,
        delete: false,
        export: false,
      });
    });
  });

  describe('when an action is exposed by the schema but absent from the permission payload', () => {
    it('should return it with visible false rather than omitting it', () => {
      const hints = buildPermissionHints({
        environmentPermissions: NORMAL_MODE,
        roleId: ADMIN_ROLE,
        readModel: readModelStub({ users: ['Block user', 'Ghost action'] }),
        collections: ['users'],
      });

      expect(hints.collections.users.actions['users.Ghost action']).toMatchObject({
        visible: false,
        requiresApprovalHint: false,
        canApproveHint: false,
        canSelfApproveHint: false,
        finality: DISPLAY_HINT_FINALITY,
      });
      expect(hints.visibleActions).toEqual(['users.Block user']);
    });
  });

  describe('when an action is absent from the schema', () => {
    it('should omit it entirely even though the payload describes it', () => {
      const hints = buildPermissionHints({
        environmentPermissions: NORMAL_MODE,
        roleId: ADMIN_ROLE,
        readModel: readModelStub({ users: [] }),
        collections: ['users'],
      });

      expect(hints.collections.users.actions).toEqual({});
    });
  });

  describe('when hints are built', () => {
    it('should never expose a roleId or a raw roles array', () => {
      const hints = buildPermissionHints({
        environmentPermissions: NORMAL_MODE,
        roleId: ADMIN_ROLE,
        readModel: readModelStub({ users: ['Block user'] }),
        collections: ['users'],
      });

      const serialized = JSON.stringify(hints);

      expect(serialized).not.toContain('roleId');
      expect(serialized).not.toContain('roles');
    });
  });
});
