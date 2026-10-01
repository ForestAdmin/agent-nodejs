export interface AgentTokenUser {
  firstName: string;
  lastName: string;
  renderingId: number;
  permissionLevel: string;
  tags?: Record<string, string>;
}

export type AgentTokenClaims<User extends AgentTokenUser> = Omit<User, 'tags'> & {
  first_name: string;
  last_name: string;
  rendering_id: string;
  permission_level: string;
  tags: Array<{ key: string; value: string }>;
};

// Ruby agents build their caller from snake_case claims and read rendering_id and tags in the shape
// of their own login token. The Node agent turns tags back into an object in parseCaller.
export default function toAgentTokenClaims<User extends AgentTokenUser>(
  user: User,
): AgentTokenClaims<User> {
  return {
    ...user,
    first_name: user.firstName,
    last_name: user.lastName,
    rendering_id: String(user.renderingId),
    permission_level: user.permissionLevel,
    tags: Object.entries(user.tags ?? {}).map(([key, value]) => ({ key, value })),
  };
}
