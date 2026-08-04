import type { EnvironmentPermissionsV4 } from '@forestadmin/forestadmin-client';

import sourceActionPermissionService from '@forestadmin/forestadmin-client/dist/permissions/action-permission';
import sourceGenerateActionsFromPermissions from '@forestadmin/forestadmin-client/dist/permissions/generate-actions-from-permissions';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CollectionActionEvent,
  CustomActionEvent,
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from '../../src/permissions/action-identifiers';
import {
  buildActionPermissions,
  isActionIdentifierAllowedForRole,
} from '../../src/permissions/action-permissions';

const ADMIN_ROLE = 1;
const VIEWER_ROLE = 2;
const UNKNOWN_ROLE = 99;

const COLLECTION = 'users';
const ACTION = 'Block user';

const CONDITION = { field: 'id', operator: 'equal', value: 1 };

function crud(overrides: Record<string, unknown> = {}) {
  return {
    browseEnabled: { roles: [ADMIN_ROLE] },
    readEnabled: true,
    editEnabled: { roles: [ADMIN_ROLE, VIEWER_ROLE] },
    addEnabled: false,
    deleteEnabled: { roles: [] },
    exportEnabled: { roles: [VIEWER_ROLE] },
    ...overrides,
  };
}

const LAST_CONDITION_FOR_THE_SAME_ROLE = { field: 'id', operator: 'equal', value: 2 };

function smartAction(overrides: Record<string, unknown> = {}) {
  return {
    triggerEnabled: { roles: [ADMIN_ROLE] },
    triggerConditions: [
      { roleId: VIEWER_ROLE, filter: CONDITION },
      { roleId: VIEWER_ROLE, filter: LAST_CONDITION_FOR_THE_SAME_ROLE },
    ],
    approvalRequired: true,
    approvalRequiredConditions: [],
    userApprovalEnabled: { roles: [VIEWER_ROLE] },
    userApprovalConditions: [],
    selfApprovalEnabled: { roles: [VIEWER_ROLE] },
    ...overrides,
  };
}

const FIXTURES: [string, EnvironmentPermissionsV4][] = [
  ['a development environment', true as EnvironmentPermissionsV4],
  [
    'a normal environment mixing global, per-role, denied and empty-role rights',
    {
      collections: {
        [COLLECTION]: { collection: crud(), actions: { [ACTION]: smartAction() } },
        posts: {
          collection: crud({ browseEnabled: true, exportEnabled: false }),
          actions: { Publish: smartAction({ triggerEnabled: true }) },
        },
      },
    } as unknown as EnvironmentPermissionsV4,
  ],
  [
    'a normal environment with no collection at all',
    { collections: {} } as unknown as EnvironmentPermissionsV4,
  ],
];

const IDENTIFIERS = [
  ...[
    CollectionActionEvent.Browse,
    CollectionActionEvent.Read,
    CollectionActionEvent.Edit,
    CollectionActionEvent.Add,
    CollectionActionEvent.Delete,
    CollectionActionEvent.Export,
  ].flatMap(action => [
    generateCollectionActionIdentifier(action, COLLECTION),
    generateCollectionActionIdentifier(action, 'posts'),
  ]),
  ...[
    CustomActionEvent.Trigger,
    CustomActionEvent.Approve,
    CustomActionEvent.SelfApprove,
    CustomActionEvent.RequireApproval,
  ].flatMap(event => [
    generateCustomActionIdentifier(event, ACTION, COLLECTION),
    generateCustomActionIdentifier(event, 'Publish', 'posts'),
  ]),
  'collection:ghost:browse',
];

const ROLES = [ADMIN_ROLE, VIEWER_ROLE, UNKNOWN_ROLE];

function sourceServiceFor(permissions: EnvironmentPermissionsV4) {
  const options = {
    permissionsCacheDurationInSeconds: 60,
    instantCacheRefresh: true,
    logger: () => {},
  };
  const serverInterface = { getEnvironmentPermissions: async () => permissions };

  const SourceService = sourceActionPermissionService as unknown as new (
    serviceOptions: unknown,
    server: unknown,
  ) => { can(roleId: number, actionName: string): Promise<boolean> };

  return new SourceService(options, serverInterface);
}

describe('the forked evaluator does not drift from forestadmin-client', () => {
  describe.each([
    ['action-permission.ts', '18b9f6a2c97008104f0bb78ee7a10b0f23df4a28c2825cc78da87b6bec867018'],
    [
      'generate-actions-from-permissions.ts',
      '1716b8236d69cc16737772d408bf4b88fc8ccca70241e067cc172a2e47cacf2e',
    ],
    [
      'generate-action-identifier.ts',
      'e1996d60241fafe389404980d1fe93d915a395002a985f2d78d507ac9bc418d8',
    ],
  ])('given the upstream source %s', (fileName, expectedSha256) => {
    it('should still hash to the reviewed revision, or the fork must be re-reviewed', () => {
      const source = readFileSync(
        join(__dirname, '../../../forestadmin-client/src/permissions', fileName),
        'utf8',
      );

      expect(createHash('sha256').update(source).digest('hex')).toBe(expectedSha256);
    });
  });

  describe.each(FIXTURES)('given %s', (_label, permissions) => {
    it('should produce the same transformation as the source', () => {
      const source = (
        sourceGenerateActionsFromPermissions as unknown as (
          input: EnvironmentPermissionsV4,
        ) => unknown
      )(permissions);

      expect(buildActionPermissions(permissions)).toEqual(source);
    });

    it('should return the same verdict as the source for every role and identifier', async () => {
      const forked = buildActionPermissions(permissions);
      const service = sourceServiceFor(permissions);

      const comparisons = await Promise.all(
        ROLES.flatMap(roleId =>
          IDENTIFIERS.map(async identifier => ({
            identifier,
            roleId,
            source: await service.can(roleId, identifier),
            forked: isActionIdentifierAllowedForRole(forked, roleId, identifier),
          })),
        ),
      );

      expect(comparisons.filter(row => row.source !== row.forked)).toEqual([]);
      expect(comparisons).toHaveLength(ROLES.length * IDENTIFIERS.length);
    });
  });

  describe.each([
    [
      'a CRUD descriptor',
      () => {
        const { deleteEnabled, ...withoutDelete } = crud();

        return { collections: { [COLLECTION]: { collection: withoutDelete, actions: {} } } };
      },
    ],
    [
      'an action-event flag',
      () => {
        const { selfApprovalEnabled, ...withoutSelfApproval } = smartAction();

        return {
          collections: {
            [COLLECTION]: { collection: crud(), actions: { [ACTION]: withoutSelfApproval } },
          },
        };
      },
    ],
  ])('given a payload missing %s', (_label, build) => {
    it('should fail the same way as the source rather than inventing a verdict', () => {
      const payload = build() as unknown as EnvironmentPermissionsV4;
      const runSource = () =>
        (
          sourceGenerateActionsFromPermissions as unknown as (
            input: EnvironmentPermissionsV4,
          ) => unknown
        )(payload);

      expect(runSource).toThrow(TypeError);
      expect(() => buildActionPermissions(payload)).toThrow(TypeError);
    });
  });
});
