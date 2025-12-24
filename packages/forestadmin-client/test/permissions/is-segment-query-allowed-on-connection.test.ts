import type { CollectionRenderingPermissionV4 } from '../../src/permissions/types';

import isSegmentQueryAllowedOnConnection from '../../src/permissions/is-segment-query-allowed-on-connection';

describe('isSegmentQueryAllowedOnConnection', () => {
  it('should return false if there is no permissions', () => {
    const permissions = {} as unknown as CollectionRenderingPermissionV4;
    expect(isSegmentQueryAllowedOnConnection(permissions, '', '')).toBe(false);
  });

  describe('when there are multiple queries', () => {
    it('should authorize the query if every subquery is allowed', () => {
      const permissions = {
        liveQuerySegments: [
          {
            query: 'SELECT * from users;',
            connectionName: 'main',
          },
          {
            query: 'SELECT * from admins;',
            connectionName: 'main',
          },
        ],
      } as unknown as CollectionRenderingPermissionV4;
      expect(
        isSegmentQueryAllowedOnConnection(
          permissions,
          'SELECT * from users /*MULTI-SEGMENTS-QUERIES-UNION*/ UNION SELECT * from admins',
          'main',
        ),
      ).toBe(true);
    });

    it('should reject the query if one subquery is not allowed', () => {
      const permissions = {
        liveQuerySegments: [
          {
            query: 'SELECT * from users;',
            connectionName: 'main',
          },
        ],
      } as unknown as CollectionRenderingPermissionV4;
      expect(
        isSegmentQueryAllowedOnConnection(
          permissions,
          'SELECT * from users /*MULTI-SEGMENTS-QUERIES-UNION*/ UNION SELECT * from admins',
          'main',
        ),
      ).toBe(false);
    });

    it('should reject if the queries are not on the same connectionName', () => {
      const permissions = {
        liveQuerySegments: [
          {
            query: 'SELECT * from users;',
            connectionName: 'main',
          },
          {
            query: 'SELECT * from admins;',
            connectionName: 'secondary',
          },
        ],
      } as unknown as CollectionRenderingPermissionV4;
      expect(
        isSegmentQueryAllowedOnConnection(
          permissions,
          'SELECT * from users /*MULTI-SEGMENTS-QUERIES-UNION*/ UNION SELECT * from admins',
          'main',
        ),
      ).toBe(false);
    });
  });

  describe('when there is only one query', () => {
    it('should return true if the query is allowed', () => {
      const permissions = {
        liveQuerySegments: [
          {
            query: 'SELECT * from users;',
            connectionName: 'main',
          },
        ],
      } as unknown as CollectionRenderingPermissionV4;
      expect(isSegmentQueryAllowedOnConnection(permissions, 'SELECT * from users;', 'main')).toBe(
        true,
      );
    });

    it('should return false if the query is not allowed', () => {
      const permissions = {
        liveQuerySegments: [
          {
            query: 'SELECT * from admins;',
            connectionName: 'main',
          },
        ],
      } as unknown as CollectionRenderingPermissionV4;
      expect(isSegmentQueryAllowedOnConnection(permissions, 'SELECT * from users;', 'main')).toBe(
        false,
      );
    });
  });
});
