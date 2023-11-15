import Cursor from '../../src/interfaces/query/cursor';

describe('Cursor', () => {
  describe('simple declaration', () => {
    describe('whith no cursors defined', () => {
      test('should default cursor to null', () => {
        const cursor = new Cursor(10);

        expect(cursor.limit).toEqual(10);
        expect(cursor.cursor).toEqual(null);
        expect(cursor.backward).toEqual(false);
      });
    });

    describe('when it is backward', () => {
      test('should define right cursor', () => {
        const cursor = new Cursor(10, 'abc', true);

        expect(cursor.limit).toEqual(10);
        expect(cursor.cursor).toEqual('abc');
        expect(cursor.backward).toEqual(true);
      });
    });

    describe('when it is forward', () => {
      test('should default to null before', () => {
        const cursor = new Cursor(10, 'abc');

        expect(cursor.limit).toEqual(10);
        expect(cursor.cursor).toEqual('abc');
        expect(cursor.backward).toEqual(false);
      });
    });
  });
});
