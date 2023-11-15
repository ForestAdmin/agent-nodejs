import Cursor from '../../src/interfaces/query/cursor';

describe('Cursor', () => {
  describe('simple declaration', () => {
    describe('whith all cursors defined', () => {
      test('should throw an error', () => {
        expect(() => new Cursor(10, { after: 'abc', before: 'abc' })).toThrow(
          `Cursor can't have before and after at same time.`,
        );
      });
    });

    describe('whith no cursors defined', () => {
      test('should default to null', () => {
        const cursor = new Cursor(10, {});

        expect(cursor).toEqual(new Cursor(10, { after: null, before: null }));
      });
    });

    describe('whith one cursor not defined', () => {
      test('should default to null after', () => {
        const cursor = new Cursor(10, { before: 'abc' });

        expect(cursor).toEqual(new Cursor(10, { after: null, before: 'abc' }));
      });

      test('should default to null before', () => {
        const cursor = new Cursor(10, { after: 'abc' });

        expect(cursor).toEqual(new Cursor(10, { after: 'abc', before: null }));
      });
    });
  });
});
