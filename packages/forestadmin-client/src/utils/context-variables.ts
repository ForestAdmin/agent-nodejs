import { Team, UserPermissionV4 } from '../permissions/types';

export type RequestContextVariables = {
  [key: string]: string | number | boolean;
};

const USER_VALUE_PREFIX = 'currentUser.';
const USER_VALUE_TAG_PREFIX = 'currentUser.tags.';
const USER_VALUE_TEAM_PREFIX = 'currentUser.team.';

export default class ContextVariables {
  private requestContextVariables: RequestContextVariables;
  private team: Team;
  private user: UserPermissionV4;

  constructor({
    requestContextVariables = {},
    team,
    user,
  }: {
    requestContextVariables?: RequestContextVariables;
    team: Team;
    user: UserPermissionV4;
  }) {
    this.requestContextVariables = requestContextVariables;
    this.team = team;
    this.user = user;
  }

  private getCurrentUserData(contextVariableKey: string): unknown {
    if (contextVariableKey.startsWith(USER_VALUE_TEAM_PREFIX)) {
      return this.team[contextVariableKey.slice(USER_VALUE_TEAM_PREFIX.length)];
    }

    if (contextVariableKey.startsWith(USER_VALUE_TAG_PREFIX)) {
      return this.user?.tags?.[contextVariableKey.substring(USER_VALUE_TAG_PREFIX.length)];
    }

    return this.user?.[contextVariableKey.substring(USER_VALUE_PREFIX.length)];
  }

  public getValue(contextVariableKey: string): unknown {
    if (contextVariableKey.startsWith(USER_VALUE_PREFIX)) {
      return this.getCurrentUserData(contextVariableKey);
    }

    return this.requestContextVariables[contextVariableKey];
  }
}
