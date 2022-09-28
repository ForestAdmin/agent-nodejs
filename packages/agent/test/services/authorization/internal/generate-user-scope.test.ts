import { GenericTreeBranch, GenericTreeLeaf } from '@forestadmin/datasource-toolkit';
import generateUserScope from '../../../../src/services/authorization/internal/generate-user-scope';

import {
  PermissionLevel,
  Team,
  UserPermissionV4,
} from '../../../../src/services/authorization/internal/types';

describe('generateUserScope', () => {
  describe('with a leaf', () => {
    it.each([42, [42, 43], ['foo', 'bar'], null, '42'])(
      'should not modify the value %s when not related to the user',
      value => {
        const condition: GenericTreeLeaf = {
          value,
          field: 'foo',
          operator: 'Equal',
        };

        const user: UserPermissionV4 = {
          id: 42,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'janedoe@forestadmin.com',
          permissionLevel: PermissionLevel.Admin,
          roleId: 42,
          tags: {},
        };

        const team: Team = {
          id: 42,
          name: 'foo',
        };

        const generated = generateUserScope(condition, team, user);

        expect(generated).toEqual(condition);
      },
    );

    it("should replace the value by the user's id", () => {
      const condition: GenericTreeLeaf = {
        value: '$currentUser.id',
        field: 'foo',
        operator: 'Equal',
      };

      const user: UserPermissionV4 = {
        id: 42,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'janedoe@forestadmin.com',
        permissionLevel: PermissionLevel.Admin,
        roleId: 42,
        tags: {},
      };

      const team: Team = {
        id: 42,
        name: 'foo',
      };

      const generated = generateUserScope(condition, team, user);

      expect(generated).toEqual({
        ...condition,
        value: 42,
      });
    });

    it("should replace the value by the user's tag", () => {
      const condition: GenericTreeLeaf = {
        value: '$currentUser.tags.foo',
        field: 'foo',
        operator: 'Equal',
      };

      const user: UserPermissionV4 = {
        id: 42,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'janedoe@forestadmin.com',
        permissionLevel: PermissionLevel.Admin,
        roleId: 42,
        tags: {
          foo: 'bar',
        },
      };

      const team: Team = {
        id: 42,
        name: 'foo',
      };

      const generated = generateUserScope(condition, team, user);

      expect(generated).toEqual({
        ...condition,
        value: 'bar',
      });
    });

    describe('with a value related to the team', () => {
      it("should replace the value by the team's property", () => {
        const condition: GenericTreeLeaf = {
          value: '$currentUser.team.name',
          field: 'foo',
          operator: 'Equal',
        };

        const user: UserPermissionV4 = {
          id: 42,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'janedoe@forest.com',
          permissionLevel: PermissionLevel.Admin,
          roleId: 42,
          tags: {},
        };

        const team: Team = {
          id: 42,
          name: 'dream',
        };

        const generated = generateUserScope(condition, team, user);

        expect(generated).toEqual({
          ...condition,
          value: 'dream',
        });
      });
    });

    describe('when the field cannot be found', () => {
      it('should replace with undefined if the dynamic value does not exist', () => {
        const condition: GenericTreeLeaf = {
          value: '$currentUser.foo',
          field: 'foo',
          operator: 'Equal',
        };

        const user: UserPermissionV4 = {
          id: 42,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'janedoe@forestadmin.com',
          permissionLevel: PermissionLevel.Admin,
          roleId: 42,
          tags: {},
        };

        const team: Team = {
          id: 42,
          name: 'foo',
        };
        const generated = generateUserScope(condition, team, user);

        expect(generated).toEqual({
          ...condition,
          value: undefined,
        });
      });
    });
  });

  describe('with a branch containing multiple leafs', () => {
    it('should replace values in every leaf', () => {
      const condition: GenericTreeBranch = {
        aggregator: 'And',
        conditions: [
          {
            value: '$currentUser.id',
            field: 'foo',
            operator: 'Equal',
          },
          {
            aggregator: 'Or',
            conditions: [
              {
                value: '$currentUser.tags.foo',
                field: 'bar',
                operator: 'Equal',
              },
              {
                value: '$currentUser.firstName',
                field: 'bar',
                operator: 'Equal',
              },
            ],
          },
        ],
      };

      const user: UserPermissionV4 = {
        id: 42,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'janedoe@forestadmin.com',
        permissionLevel: PermissionLevel.Admin,
        roleId: 42,
        tags: {
          foo: 'bar',
        },
      };

      const team: Team = {
        id: 42,
        name: 'foo',
      };

      const generated = generateUserScope(condition, team, user);

      expect(generated).toEqual({
        ...condition,
        conditions: [
          {
            value: 42,
            field: 'foo',
            operator: 'Equal',
          },
          {
            aggregator: 'Or',
            conditions: [
              {
                value: 'bar',
                field: 'bar',
                operator: 'Equal',
              },
              {
                value: 'Jane',
                field: 'bar',
                operator: 'Equal',
              },
            ],
          },
        ],
      });
    });
  });

  describe('with null', () => {
    it('should return null', () => {
      const user: UserPermissionV4 = {
        id: 42,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'janedoe@forestadmin.com',
        permissionLevel: PermissionLevel.Admin,
        roleId: 42,
        tags: {},
      };

      const team: Team = {
        id: 42,
        name: 'foo',
      };

      const generated = generateUserScope(null, team, user);

      expect(generated).toBeNull();
    });
  });
});
