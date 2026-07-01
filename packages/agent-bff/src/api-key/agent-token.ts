import type { ResolvedApiKeyIdentity } from './api-key-client';

import jsonwebtoken from 'jsonwebtoken';

export const AGENT_TOKEN_EXPIRES_IN = '5m';

export interface IssueAgentTokenParams {
  identity: ResolvedApiKeyIdentity;
  authSecret: string;
}

function tagsToRecord(tags: { key: string; value: string }[]): Record<string, string> {
  return tags.reduce((memo, { key, value }) => ({ ...memo, [key]: value }), {});
}

export function issueAgentToken({ identity, authSecret }: IssueAgentTokenParams): string {
  const { user, renderingId } = identity;
  const firstName = user.firstName ?? '';
  const lastName = user.lastName ?? '';
  const tags = tagsToRecord(user.tags);

  // snake_case aliases: Ruby/Python agents splat JWT claims into Caller (snake_case kwargs).
  return jsonwebtoken.sign(
    {
      id: user.id,
      email: user.email,
      firstName,
      lastName,
      team: user.team,
      renderingId,
      tags,
      permissionLevel: user.permissionLevel,
      first_name: firstName,
      last_name: lastName,
      rendering_id: renderingId,
      permission_level: user.permissionLevel,
    },
    authSecret,
    { algorithm: 'HS256', expiresIn: AGENT_TOKEN_EXPIRES_IN },
  );
}
