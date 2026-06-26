import type { UserInfo } from '@forestadmin/forestadmin-client';

import jsonwebtoken from 'jsonwebtoken';

export const BFF_ACCESS_TOKEN_TYPE = 'bff_access';
export const BFF_ACCESS_TOKEN_MAX_EXPIRES_IN = 15 * 60;

export interface IssueBffAccessTokenParams {
  sid: string;
  user: UserInfo;
  renderingId: number;
  authSecret: string;
  expiresInSeconds: number;
}

export interface BffAccessTokenPayload {
  type: typeof BFF_ACCESS_TOKEN_TYPE;
  sid: string;
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  team: string;
  rendering_id: string;
  permission_level: string;
  tags: Record<string, string>;
}

export function issueBffAccessToken({
  sid,
  user,
  renderingId,
  authSecret,
  expiresInSeconds,
}: IssueBffAccessTokenParams): string {
  const payload: BffAccessTokenPayload = {
    type: BFF_ACCESS_TOKEN_TYPE,
    sid,
    id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    team: user.team,
    rendering_id: String(renderingId),
    permission_level: user.permissionLevel,
    tags: user.tags ?? {},
  };

  return jsonwebtoken.sign(payload, authSecret, {
    algorithm: 'HS256',
    expiresIn: Math.min(expiresInSeconds, BFF_ACCESS_TOKEN_MAX_EXPIRES_IN),
  });
}
