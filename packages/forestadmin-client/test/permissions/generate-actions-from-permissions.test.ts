import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from '../../src/permissions/generate-action-identifier';
import generateActionsFromPermissions from '../../src/permissions/generate-actions-from-permissions';
import {
  CollectionActionEvent,
  CustomActionEvent,
  UserPermissionV4,
} from '../../src/permissions/types';

jest.mock('../../src/permissions/generate-action-identifier', () => ({
  __esModule: true,
  generateCustomActionIdentifier: jest
    .fn()
    .mockImplementation(
      (actionEventName, customActionName, collectionName) =>
        `custom:${collectionName}:${customActionName}:${actionEventName}`,
    ),
  generateCollectionActionIdentifier: jest
    .fn()
    .mockImplementation((action, collectionName) => `collection:${collectionName}:${action}`),
}));

describe('generateActionsFromPermissions', () => {
  describe('when everything is allowed', () => {
    it('should return a permission where everything is allowed', () => {
      const result = generateActionsFromPermissions(true, []);

      expect(result).toMatchObject({
        everythingAllowed: true,
      });
    });
  });

  describe('when rights are set by collection', () => {
    describe('collection access rights', () => {
      describe('globally allowed', () => {
        it('should generate permissions as globally allowed when actions are permitted', () => {
          const result = generateActionsFromPermissions(
            {
              collections: {
                'collection-id': {
                  collection: {
                    addEnabled: true,
                    browseEnabled: true,
                    deleteEnabled: true,
                    editEnabled: true,
                    exportEnabled: true,
                    readEnabled: true,
                  },
                  actions: {},
                },
              },
            },
            [],
          );

          expect(result).toEqual({
            everythingAllowed: false,
            actionsGloballyAllowed: new Set([
              'collection:collection-id:browse',
              'collection:collection-id:read',
              'collection:collection-id:edit',
              'collection:collection-id:add',
              'collection:collection-id:delete',
              'collection:collection-id:export',
            ]),
            actionsAllowedByUser: new Map(),
            actionsConditionByRoleId: new Map(),
            actionsRawRights: {
              'collection:collection-id:add': {
                description: true,
              },
              'collection:collection-id:browse': {
                description: true,
              },
              'collection:collection-id:delete': {
                description: true,
              },
              'collection:collection-id:edit': {
                description: true,
              },
              'collection:collection-id:export': {
                description: true,
              },
              'collection:collection-id:read': {
                description: true,
              },
            },
            allRoleIds: [],
            users: [],
          });

          const generateCollectionActionIdentifierMock =
            generateCollectionActionIdentifier as jest.Mock;

          Object.values(CollectionActionEvent).forEach(action => {
            expect(generateCollectionActionIdentifierMock).toHaveBeenCalledWith(
              action,
              'collection-id',
            );
          });
        });

        it('should not add rights when access is forbidden for everyone', () => {
          const result = generateActionsFromPermissions(
            {
              collections: {
                'collection-id': {
                  collection: {
                    addEnabled: false,
                    browseEnabled: false,
                    deleteEnabled: false,
                    editEnabled: false,
                    exportEnabled: false,
                    readEnabled: false,
                  },
                  actions: {},
                },
              },
            },
            [],
          );

          expect(result).toEqual({
            everythingAllowed: false,
            actionsGloballyAllowed: new Set(),
            actionsAllowedByUser: new Map(),
            actionsConditionByRoleId: new Map(),
            actionsRawRights: {
              'collection:collection-id:add': {
                description: false,
              },
              'collection:collection-id:browse': {
                description: false,
              },
              'collection:collection-id:delete': {
                description: false,
              },
              'collection:collection-id:edit': {
                description: false,
              },
              'collection:collection-id:export': {
                description: false,
              },
              'collection:collection-id:read': {
                description: false,
              },
            },
            allRoleIds: [],
            users: [],
          });
        });
      });

      describe('allowed by role', () => {
        it('should generate permissions with a list of users', () => {
          const users = [
            { id: 10, roleId: 1 },
            { id: 20, roleId: 2 },
            { id: 30, roleId: 3 },
            { id: 40, roleId: 4 },
          ];

          const result = generateActionsFromPermissions(
            {
              collections: {
                'collection-id': {
                  collection: {
                    addEnabled: { roles: [1] },
                    browseEnabled: { roles: [2] },
                    deleteEnabled: { roles: [1, 2] },
                    editEnabled: { roles: [3] },
                    exportEnabled: { roles: [4] },
                    readEnabled: { roles: [3, 4] },
                  },
                  actions: {},
                },
              },
            },
            users as UserPermissionV4[],
          );

          expect(result).toEqual({
            everythingAllowed: false,
            actionsGloballyAllowed: new Set(),
            actionsAllowedByUser: new Map([
              ['collection:collection-id:browse', new Set(['20'])],
              ['collection:collection-id:read', new Set(['30', '40'])],
              ['collection:collection-id:edit', new Set(['30'])],
              ['collection:collection-id:add', new Set(['10'])],
              ['collection:collection-id:delete', new Set(['10', '20'])],
              ['collection:collection-id:export', new Set(['40'])],
            ]),
            actionsRawRights: {
              'collection:collection-id:add': {
                description: {
                  roles: [1],
                },
              },
              'collection:collection-id:browse': {
                description: {
                  roles: [2],
                },
              },
              'collection:collection-id:delete': {
                description: {
                  roles: [1, 2],
                },
              },
              'collection:collection-id:edit': {
                description: {
                  roles: [3],
                },
              },
              'collection:collection-id:export': {
                description: {
                  roles: [4],
                },
              },
              'collection:collection-id:read': {
                description: {
                  roles: [3, 4],
                },
              },
            },
            allRoleIds: [1, 2, 3, 4],
            actionsConditionByRoleId: new Map(),
            users,
          });

          const generateCollectionActionIdentifierMock =
            generateCollectionActionIdentifier as jest.Mock;

          Object.values(CollectionActionEvent).forEach(action => {
            expect(generateCollectionActionIdentifierMock).toHaveBeenCalledWith(
              action,
              'collection-id',
            );
          });
        });

        it('should correctly handle a role that is not defined', async () => {
          const users = [{ id: 10, roleId: 1 }];

          const result = generateActionsFromPermissions(
            {
              collections: {
                'collection-id': {
                  collection: {
                    addEnabled: { roles: [1, 2] },
                    browseEnabled: { roles: [1, 2] },
                    deleteEnabled: { roles: [1, 2] },
                    editEnabled: { roles: [1, 2] },
                    exportEnabled: { roles: [1, 2] },
                    readEnabled: { roles: [1, 2] },
                  },
                  actions: {},
                },
              },
            },
            users as UserPermissionV4[],
          );

          expect(result).toEqual({
            everythingAllowed: false,
            actionsGloballyAllowed: new Set(),
            actionsAllowedByUser: new Map([
              ['collection:collection-id:browse', new Set(['10'])],
              ['collection:collection-id:read', new Set(['10'])],
              ['collection:collection-id:edit', new Set(['10'])],
              ['collection:collection-id:add', new Set(['10'])],
              ['collection:collection-id:delete', new Set(['10'])],
              ['collection:collection-id:export', new Set(['10'])],
            ]),
            actionsRawRights: {
              'collection:collection-id:add': {
                description: {
                  roles: [1, 2],
                },
              },
              'collection:collection-id:browse': {
                description: {
                  roles: [1, 2],
                },
              },
              'collection:collection-id:delete': {
                description: {
                  roles: [1, 2],
                },
              },
              'collection:collection-id:edit': {
                description: {
                  roles: [1, 2],
                },
              },
              'collection:collection-id:export': {
                description: {
                  roles: [1, 2],
                },
              },
              'collection:collection-id:read': {
                description: {
                  roles: [1, 2],
                },
              },
            },
            actionsConditionByRoleId: new Map(),
            users,
            allRoleIds: [1],
          });
        });
      });
    });

    describe('custom action rights', () => {
      describe('globally allowed', () => {
        it('should add the custom action to the list of global permission', () => {
          const result = generateActionsFromPermissions(
            {
              collections: {
                'collection-id': {
                  collection: {
                    addEnabled: false,
                    browseEnabled: false,
                    deleteEnabled: false,
                    editEnabled: false,
                    exportEnabled: false,
                    readEnabled: false,
                  },
                  actions: {
                    'custom-action-id': {
                      triggerEnabled: true,
                      selfApprovalEnabled: true,
                      approvalRequired: true,
                      userApprovalEnabled: true,
                      triggerConditions: [],
                      approvalRequiredConditions: [],
                      userApprovalConditions: [],
                    },
                  },
                },
              },
            },
            [],
          );

          expect(result).toEqual({
            everythingAllowed: false,
            actionsGloballyAllowed: new Set([
              'custom:collection-id:custom-action-id:approve',
              'custom:collection-id:custom-action-id:self-approve',
              'custom:collection-id:custom-action-id:trigger',
              'custom:collection-id:custom-action-id:require-approval',
            ]),
            actionsAllowedByUser: new Map(),
            actionsConditionByRoleId: new Map([
              ['custom:collection-id:custom-action-id:approve', new Map()],
              ['custom:collection-id:custom-action-id:trigger', new Map()],
              ['custom:collection-id:custom-action-id:require-approval', new Map()],
            ]),
            actionsRawRights: {
              'collection:collection-id:browse': {
                description: false,
              },
              'collection:collection-id:read': {
                description: false,
              },
              'collection:collection-id:edit': {
                description: false,
              },
              'collection:collection-id:add': {
                description: false,
              },
              'collection:collection-id:delete': {
                description: false,
              },
              'collection:collection-id:export': {
                description: false,
              },
              'custom:collection-id:custom-action-id:approve': {
                description: true,
                conditions: [],
              },
              'custom:collection-id:custom-action-id:self-approve': {
                description: true,
              },
              'custom:collection-id:custom-action-id:trigger': {
                description: true,
                conditions: [],
              },
              'custom:collection-id:custom-action-id:require-approval': {
                description: true,
                conditions: [],
              },
            },
            allRoleIds: [],
            users: [],
          });

          const generateCustomActionIdentifierMock = generateCustomActionIdentifier as jest.Mock;

          Object.values(CustomActionEvent).forEach(action => {
            expect(generateCustomActionIdentifierMock).toHaveBeenCalledWith(
              action,
              'custom-action-id',
              'collection-id',
            );
          });
        });

        it('should not add permissions when nothing is allowed', () => {
          const result = generateActionsFromPermissions(
            {
              collections: {
                'collection-id': {
                  collection: {
                    addEnabled: false,
                    browseEnabled: false,
                    deleteEnabled: false,
                    editEnabled: false,
                    exportEnabled: false,
                    readEnabled: false,
                  },
                  actions: {
                    'custom-action-id': {
                      triggerEnabled: false,
                      selfApprovalEnabled: false,
                      approvalRequired: false,
                      userApprovalEnabled: false,
                      triggerConditions: [],
                      approvalRequiredConditions: [],
                      userApprovalConditions: [],
                    },
                  },
                },
              },
            },
            [],
          );

          expect(result).toEqual({
            everythingAllowed: false,
            actionsGloballyAllowed: new Set(),
            actionsAllowedByUser: new Map(),
            actionsConditionByRoleId: new Map([
              ['custom:collection-id:custom-action-id:approve', new Map()],
              ['custom:collection-id:custom-action-id:trigger', new Map()],
              ['custom:collection-id:custom-action-id:require-approval', new Map()],
            ]),
            actionsRawRights: {
              'collection:collection-id:browse': {
                description: false,
              },
              'collection:collection-id:read': {
                description: false,
              },
              'collection:collection-id:edit': {
                description: false,
              },
              'collection:collection-id:add': {
                description: false,
              },
              'collection:collection-id:delete': {
                description: false,
              },
              'collection:collection-id:export': {
                description: false,
              },
              'custom:collection-id:custom-action-id:approve': {
                description: false,
                conditions: [],
              },
              'custom:collection-id:custom-action-id:self-approve': {
                description: false,
              },
              'custom:collection-id:custom-action-id:trigger': {
                description: false,
                conditions: [],
              },
              'custom:collection-id:custom-action-id:require-approval': {
                description: false,
                conditions: [],
              },
            },
            allRoleIds: [],
            users: [],
          });
        });
      });

      describe('allowed by role', () => {
        it('should generate permissions with a list of users', () => {
          const users = [
            { id: 10, roleId: 1 },
            { id: 20, roleId: 1 },
            { id: 30, roleId: 2 },
            { id: 40, roleId: 3 },
          ];

          const result = generateActionsFromPermissions(
            {
              collections: {
                'collection-id': {
                  collection: {
                    addEnabled: false,
                    browseEnabled: false,
                    deleteEnabled: false,
                    editEnabled: false,
                    exportEnabled: false,
                    readEnabled: false,
                  },
                  actions: {
                    'custom-action-id': {
                      triggerEnabled: { roles: [1] },
                      selfApprovalEnabled: { roles: [2] },
                      approvalRequired: { roles: [1, 2] },
                      userApprovalEnabled: { roles: [3] },
                      triggerConditions: [],
                      approvalRequiredConditions: [],
                      userApprovalConditions: [],
                    },
                  },
                },
              },
            },
            users as UserPermissionV4[],
          );

          expect(result).toEqual({
            everythingAllowed: false,
            actionsGloballyAllowed: new Set(),
            actionsAllowedByUser: new Map([
              ['custom:collection-id:custom-action-id:approve', new Set(['40'])],
              ['custom:collection-id:custom-action-id:self-approve', new Set(['30'])],
              ['custom:collection-id:custom-action-id:trigger', new Set(['10', '20'])],
              [
                'custom:collection-id:custom-action-id:require-approval',
                new Set(['10', '20', '30']),
              ],
            ]),
            actionsConditionByRoleId: new Map([
              ['custom:collection-id:custom-action-id:approve', new Map()],
              ['custom:collection-id:custom-action-id:trigger', new Map()],
              ['custom:collection-id:custom-action-id:require-approval', new Map()],
            ]),
            actionsRawRights: {
              'collection:collection-id:browse': {
                description: false,
              },
              'collection:collection-id:read': {
                description: false,
              },
              'collection:collection-id:edit': {
                description: false,
              },
              'collection:collection-id:add': {
                description: false,
              },
              'collection:collection-id:delete': {
                description: false,
              },
              'collection:collection-id:export': {
                description: false,
              },
              'custom:collection-id:custom-action-id:approve': {
                description: {
                  roles: [3],
                },
                conditions: [],
              },
              'custom:collection-id:custom-action-id:self-approve': {
                description: {
                  roles: [2],
                },
              },
              'custom:collection-id:custom-action-id:trigger': {
                description: {
                  roles: [1],
                },
                conditions: [],
              },
              'custom:collection-id:custom-action-id:require-approval': {
                description: {
                  roles: [1, 2],
                },
                conditions: [],
              },
            },
            allRoleIds: [1, 2, 3],
            users,
          });

          const generateCustomActionIdentifierMock = generateCustomActionIdentifier as jest.Mock;

          Object.values(CustomActionEvent).forEach(action => {
            expect(generateCustomActionIdentifierMock).toHaveBeenCalledWith(
              action,
              'custom-action-id',
              'collection-id',
            );
          });
        });
      });

      describe('allowed by role with conditions', () => {
        it('should generate permissions with a list of users', () => {
          const users = [
            { id: 10, roleId: 1 },
            { id: 20, roleId: 1 },
            { id: 30, roleId: 2 },
            { id: 40, roleId: 3 },
          ];
          const result = generateActionsFromPermissions(
            {
              collections: {
                'collection-id': {
                  collection: {
                    addEnabled: false,
                    browseEnabled: false,
                    deleteEnabled: false,
                    editEnabled: false,
                    exportEnabled: false,
                    readEnabled: false,
                  },
                  actions: {
                    'custom-action-id': {
                      triggerEnabled: { roles: [1] },
                      selfApprovalEnabled: { roles: [2] },
                      approvalRequired: { roles: [1, 2] },
                      userApprovalEnabled: { roles: [3] },
                      triggerConditions: [
                        {
                          roleId: 1,
                          filter: {
                            field: 'filed',
                            operator: 'equal',
                            value: 'value',
                            source: 'data',
                          },
                        },
                      ],
                      approvalRequiredConditions: [
                        {
                          roleId: 2,
                          filter: {
                            field: 'filed2',
                            operator: 'not_equal',
                            value: 'value',
                            source: 'data',
                          },
                        },
                      ],
                      userApprovalConditions: [
                        {
                          roleId: 3,
                          filter: {
                            field: 'filed3',
                            operator: 'greater_than',
                            value: 'value',
                            source: 'data',
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
            users as UserPermissionV4[],
          );

          expect(result).toEqual({
            everythingAllowed: false,
            actionsGloballyAllowed: new Set(),
            actionsAllowedByUser: new Map([
              ['custom:collection-id:custom-action-id:approve', new Set(['40'])],
              ['custom:collection-id:custom-action-id:self-approve', new Set(['30'])],
              ['custom:collection-id:custom-action-id:trigger', new Set(['10', '20'])],
              [
                'custom:collection-id:custom-action-id:require-approval',
                new Set(['10', '20', '30']),
              ],
            ]),
            actionsConditionByRoleId: new Map([
              [
                'custom:collection-id:custom-action-id:trigger',
                new Map([
                  [
                    1,
                    {
                      field: 'filed',
                      operator: 'equal',
                      value: 'value',
                      source: 'data',
                    },
                  ],
                ]),
              ],
              [
                'custom:collection-id:custom-action-id:require-approval',
                new Map([
                  [
                    2,
                    {
                      field: 'filed2',
                      operator: 'not_equal',
                      value: 'value',
                      source: 'data',
                    },
                  ],
                ]),
              ],
              [
                'custom:collection-id:custom-action-id:approve',
                new Map([
                  [
                    3,
                    {
                      field: 'filed3',
                      operator: 'greater_than',
                      value: 'value',
                      source: 'data',
                    },
                  ],
                ]),
              ],
            ]),
            users,
            allRoleIds: [1, 2, 3],
            actionsRawRights: {
              'collection:collection-id:browse': {
                description: false,
              },
              'collection:collection-id:read': {
                description: false,
              },
              'collection:collection-id:edit': {
                description: false,
              },
              'collection:collection-id:add': {
                description: false,
              },
              'collection:collection-id:delete': {
                description: false,
              },
              'collection:collection-id:export': {
                description: false,
              },
              'custom:collection-id:custom-action-id:approve': {
                description: {
                  roles: [3],
                },
                conditions: [
                  {
                    roleId: 3,
                    filter: {
                      field: 'filed3',
                      operator: 'greater_than',
                      value: 'value',
                      source: 'data',
                    },
                  },
                ],
              },
              'custom:collection-id:custom-action-id:self-approve': {
                description: {
                  roles: [2],
                },
              },
              'custom:collection-id:custom-action-id:trigger': {
                description: {
                  roles: [1],
                },
                conditions: [
                  {
                    roleId: 1,
                    filter: {
                      field: 'filed',
                      operator: 'equal',
                      value: 'value',
                      source: 'data',
                    },
                  },
                ],
              },
              'custom:collection-id:custom-action-id:require-approval': {
                description: {
                  roles: [1, 2],
                },
                conditions: [
                  {
                    roleId: 2,
                    filter: {
                      field: 'filed2',
                      operator: 'not_equal',
                      value: 'value',
                      source: 'data',
                    },
                  },
                ],
              },
            },
          });

          const generateCustomActionIdentifierMock = generateCustomActionIdentifier as jest.Mock;

          Object.values(CustomActionEvent).forEach(action => {
            expect(generateCustomActionIdentifierMock).toHaveBeenCalledWith(
              action,
              'custom-action-id',
              'collection-id',
            );
          });
        });
      });
    });
  });
});
