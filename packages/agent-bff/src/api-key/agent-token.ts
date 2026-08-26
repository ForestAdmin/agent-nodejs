import type { ResolvedApiKeyIdentity } from './api-key-client';
import type { BffAccessTokenPayload } from '../oauth/bff-token';

import jsonwebtoken from 'jsonwebtoken';

import { requireRenderingId } from '../auth/auth-mode';

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

interface AgentCallerClaims {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  team: string;
  renderingId: number;
  tags: Record<string, string>;
  permissionLevel: string;
  role?: string;
}

function signWithSnakeCaseAliasesForRubyAndPythonAgents(
  claims: AgentCallerClaims,
  authSecret: string,
): string {
  const firstName = claims.firstName ?? '';
  const lastName = claims.lastName ?? '';

  return jsonwebtoken.sign(
    {
      ...claims,
      firstName,
      lastName,
      first_name: firstName,
      last_name: lastName,
      rendering_id: claims.renderingId,
      permission_level: claims.permissionLevel,
    },
    authSecret,
    { algorithm: 'HS256', expiresIn: AGENT_TOKEN_EXPIRES_IN },
  );
}

export function issueAgentToken({ identity, authSecret }: IssueAgentTokenParams): string {
  const { user, renderingId } = identity;

  return signWithSnakeCaseAliasesForRubyAndPythonAgents(
    {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      team: user.team,
      renderingId,
      tags: tagsToRecord(user.tags),
      permissionLevel: user.permissionLevel,
    },
    authSecret,
  );
}

export function issueAgentTokenFromPrincipal({
  principal,
  authSecret,
}: IssueAgentTokenFromPrincipalParams): string {
  const renderingId = requireRenderingId(principal);

  return signWithSnakeCaseAliasesForRubyAndPythonAgents(
    {
      id: principal.id,
      email: principal.email,
      firstName: principal.first_name,
      lastName: principal.last_name,
      team: principal.team,
      renderingId,
      tags: principal.tags ?? {},
      permissionLevel: principal.permission_level,
      role: principal.role,
    },
    authSecret,
  );
}
