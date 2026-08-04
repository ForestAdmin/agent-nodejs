import type { ResolvedApiKeyIdentity } from './api-key-client';
import type { BffAccessTokenPayload } from '../oauth/bff-token';

import jsonwebtoken from 'jsonwebtoken';

import { unauthorized } from '../http/bff-http-error';

export const AGENT_TOKEN_EXPIRES_IN = '5m';

export interface IssueAgentTokenParams {
  identity: ResolvedApiKeyIdentity;
  authSecret: string;
}

export interface IssueAgentTokenFromPrincipalParams {
  principal: BffAccessTokenPayload;
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

export function issueAgentTokenFromPrincipal({
  principal,
  authSecret,
}: IssueAgentTokenFromPrincipalParams): string {
  const renderingId = Number(principal.rendering_id);

  if (!Number.isInteger(renderingId)) {
    throw unauthorized('The session carries no usable rendering');
  }

  const firstName = principal.first_name ?? '';
  const lastName = principal.last_name ?? '';

  return jsonwebtoken.sign(
    {
      id: principal.id,
      email: principal.email,
      firstName,
      lastName,
      team: principal.team,
      renderingId,
      tags: principal.tags ?? {},
      permissionLevel: principal.permission_level,
      role: principal.role,
      first_name: firstName,
      last_name: lastName,
      rendering_id: renderingId,
      permission_level: principal.permission_level,
    },
    authSecret,
    { algorithm: 'HS256', expiresIn: AGENT_TOKEN_EXPIRES_IN },
  );
}
