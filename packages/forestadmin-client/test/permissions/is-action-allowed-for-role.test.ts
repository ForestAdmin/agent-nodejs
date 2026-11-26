import type { EnvironmentPermissionsV4 } from '../../src/permissions/types';

import { isActionAllowedForRole } from '../../src';
import generateActionsFromPermissions from '../../src/permissions/generate-actions-from-permissions';

const ADMIN_ROLE = 1;
const VIEWER_ROLE = 2;

const PERMISSIONS = generateActionsFromPermissions({
  collections: {
    users: {
      collection: {
        browseEnabled: true,
        readEnabled: { roles: [ADMIN_ROLE] },
        editEnabled: { roles: [ADMIN_ROLE] },
        addEnabled: { roles: [ADMIN_ROLE] },
        deleteEnabled: { roles: [ADMIN_ROLE] },
        exportEnabled: { roles: [ADMIN_ROLE] },
      },
      actions: {},
    },
  },
} as unknown as EnvironmentPermissionsV4);

describe('isActionAllowedForRole', () => {
  it('should allow any action in development', () => {
    expect(
      isActionAllowedForRole(generateActionsFromPermissions(true), VIEWER_ROLE, 'anything'),
    ).toBe(true);
  });

  it('should allow a globally allowed action to a role no descriptor names', () => {
    expect(isActionAllowedForRole(PERMISSIONS, VIEWER_ROLE, 'collection:users:browse')).toBe(true);
  });

  it('should allow an action to a role it lists', () => {
    expect(isActionAllowedForRole(PERMISSIONS, ADMIN_ROLE, 'collection:users:read')).toBe(true);
  });

  it('should deny an action to a role it does not list', () => {
    expect(isActionAllowedForRole(PERMISSIONS, VIEWER_ROLE, 'collection:users:read')).toBe(false);
  });

  it('should deny an action absent from the permissions', () => {
    expect(isActionAllowedForRole(PERMISSIONS, ADMIN_ROLE, 'collection:ghost:browse')).toBe(false);
  });
});
