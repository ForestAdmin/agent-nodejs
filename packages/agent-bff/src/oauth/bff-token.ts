import type { UserInfo } from '@forestadmin/forestadmin-client';

import jsonwebtoken from 'jsonwebtoken';

export const BFF_ACCESS_TOKEN_TYPE = 'bff_access';
export const BFF_ACCESS_TOKEN_MAX_EXPIRES_IN = 15 * 60;

export interface IssueBffAccessTokenParams {
  sid: string;
  serverAccess: string;
  user: UserInfo;
  renderingId: number;
  authSecret: string;
  expiresInSeconds: number;
}

export interface BffAccessTokenPayload {
  type: typeof BFF_ACCESS_TOKEN_TYPE;
  sid: string;
  server_access?: string;
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  team: string;
  rendering_id: string;
  permission_level: string;
  role?: string;
  tags: Record<string, string>;
}

export function issueBffAccessToken({
  sid,
  serverAccess,
  user,
  renderingId,
  authSecret,
  expiresInSeconds,
}: IssueBffAccessTokenParams): string {
  const payload: BffAccessTokenPayload = {
    type: BFF_ACCESS_TOKEN_TYPE,
    sid,
    server_access: serverAccess,
    id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    team: user.team,
    rendering_id: String(renderingId),
    permission_level: user.permissionLevel,
    role: user.role,
    tags: user.tags ?? {},
  };

  return jsonwebtoken.sign(payload, authSecret, {
    algorithm: 'HS256',
    expiresIn: Math.min(expiresInSeconds, BFF_ACCESS_TOKEN_MAX_EXPIRES_IN),
  });
}
