import { GenericTree, GenericTreeBranch, GenericTreeLeaf } from '@forestadmin/datasource-toolkit';
import { Team, UserPermissionV4 } from './types';

const USER_VALUE_PREFIX = '$currentUser.';
const USER_VALUE_TAG_PREFIX = '$currentUser.tags.';
const USER_VALUE_TEAM_PREFIX = '$currentUser.team.';

function generateUserValue(value: string | unknown, team: Team, user: UserPermissionV4) {
  if (typeof value !== 'string' || !value.startsWith(USER_VALUE_PREFIX)) {
    return value;
  }

  if (value.startsWith(USER_VALUE_TEAM_PREFIX)) {
    return team[value.slice(USER_VALUE_TEAM_PREFIX.length)];
  }

  if (value.startsWith(USER_VALUE_TAG_PREFIX)) {
    return user?.tags?.[value.substring(USER_VALUE_TAG_PREFIX.length)];
  }

  return user?.[value.substring(USER_VALUE_PREFIX.length)];
}

export default function generateUserScope(
  filter: GenericTree | null,
  team: Team,
  user: UserPermissionV4,
): GenericTree {
  if (!filter) {
    return null;
  }

  const branch = filter as GenericTreeBranch;

  if (branch.aggregator) {
    return {
      ...filter,
      conditions: branch.conditions.map(condition => generateUserScope(condition, team, user)),
    };
  }

  const leaf = filter as GenericTreeLeaf;

  return {
    ...filter,
    value: generateUserValue(leaf.value, team, user),
  };
}
