import type { UserInfo } from '@forestadmin/forestadmin-client';

import jsonwebtoken from 'jsonwebtoken';

import { BFF_ACCESS_TOKEN_TYPE, issueBffAccessToken } from '../../src/oauth/bff-token';

const AUTH_SECRET = 'auth-secret';

const USER: UserInfo = {
  id: 42,
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  team: 'Support',
  renderingId: 17,
  role: 'Admin',
  tags: { plan: 'pro' },
  permissionLevel: 'admin',
};

function decode(token: string) {
  return jsonwebtoken.verify(token, AUTH_SECRET) as jsonwebtoken.JwtPayload &
    Record<string, unknown>;
}

describe('bff-token', () => {
  describe('when issuing a BFF access token', () => {
    it('should carry type bff_access, sid, whitelisted identity claims and tags', () => {
      const token = issueBffAccessToken({
        sid: 'sid-1',
        user: USER,
        renderingId: 17,
        authSecret: AUTH_SECRET,
        expiresInSeconds: 900,
      });

      const payload = decode(token);

      expect(payload.type).toBe(BFF_ACCESS_TOKEN_TYPE);
      expect(payload.sid).toBe('sid-1');
      expect(payload.id).toBe(42);
      expect(payload.email).toBe('ada@example.com');
      expect(payload.first_name).toBe('Ada');
      expect(payload.last_name).toBe('Lovelace');
      expect(payload.rendering_id).toBe('17');
      expect(payload.permission_level).toBe('admin');
      expect(payload.tags).toEqual({ plan: 'pro' });
    });

    it('should default tags to {} when the user has none', () => {
      const token = issueBffAccessToken({
        sid: 'sid-2',
        user: { ...USER, tags: undefined as unknown as UserInfo['tags'] },
        renderingId: 17,
        authSecret: AUTH_SECRET,
        expiresInSeconds: 900,
      });

      expect(decode(token).tags).toEqual({});
    });

    it('should set exp - iat to the provided expiresInSeconds', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));

      const token = issueBffAccessToken({
        sid: 'sid-3',
        user: USER,
        renderingId: 17,
        authSecret: AUTH_SECRET,
        expiresInSeconds: 120,
      });

      const payload = decode(token);
      expect((payload.exp as number) - (payload.iat as number)).toBe(120);

      jest.useRealTimers();
    });

    it('should not leak any non-whitelisted user field into the payload', () => {
      const token = issueBffAccessToken({
        sid: 'sid-4',
        user: { ...USER, role: 'SHOULD-NOT-LEAK' as string } as UserInfo,
        renderingId: 17,
        authSecret: AUTH_SECRET,
        expiresInSeconds: 900,
      });

      expect(JSON.stringify(decode(token))).not.toContain('SHOULD-NOT-LEAK');
    });

    it('should cap the expiry at the 15-minute ceiling even if the caller asks for more', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));

      const token = issueBffAccessToken({
        sid: 'sid-5',
        user: USER,
        renderingId: 17,
        authSecret: AUTH_SECRET,
        expiresInSeconds: 3600,
      });

      const payload = decode(token);
      expect((payload.exp as number) - (payload.iat as number)).toBe(15 * 60);

      jest.useRealTimers();
    });
  });
});
