import { CollectionSegment } from '../../dist/permissions/types';
import isSegmentQueryAllowed from '../../src/permissions/is-segment-query-authorized';

describe('isSegmentQueryAuthorized', () => {
  it('should return false if there are no authorized segments', () => {
    expect(isSegmentQueryAllowed('SELECT * from users', [])).toBe(false);
  });

  describe('when there are multiple queries', () => {
    it('should authorize the query if every subquery is allowed', () => {
      expect(
        isSegmentQueryAllowed(
          'SELECT * from users /*MULTI-SEGMENTS-QUERIES-UNION*/ UNION SELECT * from admins',
          [
            { query: 'SELECT * from users; ' },
            { query: 'SELECT * from admins; ' },
          ] as unknown as CollectionSegment[],
        ),
      ).toBe(true);
    });

    it('should reject the query if one subquery is not allowed', () => {
      expect(
        isSegmentQueryAllowed(
          'SELECT * from users /*MULTI-SEGMENTS-QUERIES-UNION*/ UNION SELECT * from admins',
          [{ query: 'SELECT * from users; ' }] as unknown as CollectionSegment[],
        ),
      ).toBe(false);
    });
  });

  describe('when there is only one query', () => {
    it('should return true if the query is allowed', () => {
      expect(
        isSegmentQueryAllowed('SELECT * from users;', [
          { query: 'SELECT * from users;' },
        ] as unknown as CollectionSegment[]),
      ).toBe(true);
    });

    it('should return false if the query is not allowed', () => {
      expect(
        isSegmentQueryAllowed('SELECT * from users;', [
          { query: 'SELECT * from admins;' },
        ] as unknown as CollectionSegment[]),
      ).toBe(false);
    });
  });
});
