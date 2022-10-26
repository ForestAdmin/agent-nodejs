import type { GenericTree } from '@forestadmin/datasource-toolkit';

import { PermissionLevel } from '../../src/permissions/types';
import ContextVariables from '../../src/utils/context-variables';
import ContextVariablesInjector from '../../src/utils/context-variables-injector';

describe('ContextVariablesInjector', () => {
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

  describe('injectContextInValue', () => {
    describe('with a number', () => {
      test('it should return it as it is', () => {
        const result = ContextVariablesInjector.injectContextInValue(8, contextVariables);

        expect(result).toStrictEqual(8);
      });
    });

    describe('with an array', () => {
      test('it should return it as it is', () => {
        const value = ['test', 'me'];
        const result = ContextVariablesInjector.injectContextInValue(value, contextVariables);

        expect(result).toStrictEqual(value);
      });
    });

    describe('with a string', () => {
      test('it should replace all variables', () => {
        const firstValuePart =
          'It should be {{siths.selectedRecord.power}} of rank {{siths.selectedRecord.rank}}.';
        const secondValuePart = 'But {{siths.selectedRecord.power}} can be duplicated.';
        const result = ContextVariablesInjector.injectContextInValue(
          `${firstValuePart} ${secondValuePart}`,
          contextVariables,
        );

        expect(result).toStrictEqual(
          'It should be electrocute of rank 3. But electrocute can be duplicated.',
        );
      });

      test('it should replace all currentUser variables', () => {
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
          expect(
            ContextVariablesInjector.injectContextInValue(
              `{{currentUser.${key}}}`,
              contextVariables,
            ),
          ).toStrictEqual(`${expectedValue}`);
        });
      });
    });
  });

  describe('injectContextInFilter', () => {
    describe('with a leaf', () => {
      it.each([42, [42, 43], ['foo', 'bar'], null, '42'])(
        'should not modify the value %s when not related to the user',
        value => {
          const condition: GenericTree = {
            value,
            field: 'foo',
            operator: 'Equal',
          };

          const generated = ContextVariablesInjector.injectContextInFilter(
            condition,
            contextVariables,
          );

          expect(generated).toEqual(condition);
        },
      );

      it("should replace the value by the user's id", () => {
        const condition: GenericTree = {
          value: '{{currentUser.id}}',
          field: 'foo',
          operator: 'Equal',
        };

        const generated = ContextVariablesInjector.injectContextInFilter(
          condition,
          contextVariables,
        );

        expect(generated).toEqual({
          ...condition,
          value: `${user.id}`,
        });
      });

      it("should replace the value by the user's tag", () => {
        const condition: GenericTree = {
          value: '{{currentUser.tags.planet}}',
          field: 'foo',
          operator: 'Equal',
        };

        const generated = ContextVariablesInjector.injectContextInFilter(
          condition,
          contextVariables,
        );

        expect(generated).toEqual({
          ...condition,
          value: user.tags.planet,
        });
      });

      describe('with a value related to the team', () => {
        it("should replace the value by the team's property", () => {
          const condition: GenericTree = {
            value: '{{currentUser.team.name}}',
            field: 'foo',
            operator: 'Equal',
          };

          const generated = ContextVariablesInjector.injectContextInFilter(
            condition,
            contextVariables,
          );

          expect(generated).toEqual({
            ...condition,
            value: team.name,
          });
        });
      });

      describe('when the field cannot be found', () => {
        it('should replace with undefined if the dynamic value does not exist', () => {
          const condition: GenericTree = {
            value: '{{currentUser.foo}}',
            field: 'foo',
            operator: 'Equal',
          };

          const generated = ContextVariablesInjector.injectContextInFilter(
            condition,
            contextVariables,
          );

          expect(generated).toEqual({
            ...condition,
            value: 'undefined',
          });
        });
      });
    });

    describe('with a branch containing multiple leafs', () => {
      it('should replace values in every leaf', () => {
        const condition: GenericTree = {
          aggregator: 'And',
          conditions: [
            {
              value: '{{currentUser.id}}',
              field: 'foo',
              operator: 'Equal',
            },
            {
              aggregator: 'Or',
              conditions: [
                {
                  value: '{{currentUser.tags.planet}}',
                  field: 'bar',
                  operator: 'Equal',
                },
                {
                  value: '{{currentUser.firstName}}',
                  field: 'bar',
                  operator: 'Equal',
                },
              ],
            },
          ],
        };

        const generated = ContextVariablesInjector.injectContextInFilter(
          condition,
          contextVariables,
        );

        expect(generated).toEqual({
          ...condition,
          conditions: [
            {
              value: `${user.id}`,
              field: 'foo',
              operator: 'Equal',
            },
            {
              aggregator: 'Or',
              conditions: [
                {
                  value: user.tags.planet,
                  field: 'bar',
                  operator: 'Equal',
                },
                {
                  value: user.firstName,
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
        const generated = ContextVariablesInjector.injectContextInFilter(null, contextVariables);

        expect(generated).toBeNull();
      });
    });
  });
});
