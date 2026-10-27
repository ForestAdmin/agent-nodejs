import Serializer from '../../src/utils/serializer';

describe('Serializer', () => {
  describe('flatten', () => {
    it('expands nested maps declared as columns into arrow-notation fields', () => {
      const record = Serializer.flatten(
        { pk: 'a', address: { city: 'Paris', geo: { lat: 1 } } },
        new Set(['pk', 'address@@@city', 'address@@@geo@@@lat']),
      );

      expect(record).toEqual({ pk: 'a', 'address@@@city': 'Paris', 'address@@@geo@@@lat': 1 });
    });

    it('keeps a map as Json when no nested column is declared under it', () => {
      const record = Serializer.flatten({ pk: 'a', meta: { x: 1 } }, new Set(['pk', 'meta']));

      expect(record).toEqual({ pk: 'a', meta: { x: 1 } });
    });

    it('turns sets into arrays', () => {
      const record = Serializer.flatten({ tags: new Set(['a', 'b']) }, new Set(['tags']));

      expect(record).toEqual({ tags: ['a', 'b'] });
    });

    it('turns dates into ISO strings', () => {
      const record = Serializer.flatten(
        { at: new Date('2024-01-15T10:00:00.000Z') },
        new Set(['at']),
      );

      expect(record).toEqual({ at: '2024-01-15T10:00:00.000Z' });
    });

    it('turns binary values into base64 strings', () => {
      const record = Serializer.flatten({ blob: Buffer.from('hi') }, new Set(['blob']));

      expect(record).toEqual({ blob: 'aGk=' });
    });

    it('keeps GeoJSON points untouched', () => {
      const point = { type: 'Point', coordinates: [1, 2] };

      expect(Serializer.flatten({ loc: point }, new Set(['loc']))).toEqual({ loc: point });
    });

    it('keeps null values', () => {
      expect(Serializer.flatten({ a: null }, new Set(['a']))).toEqual({ a: null });
    });
  });

  describe('unflatten', () => {
    it('rebuilds nested maps from arrow-notation fields', () => {
      expect(
        Serializer.unflatten({ pk: 'a', 'address@@@city': 'Paris', 'address@@@zip': '75' }),
      ).toEqual({
        pk: 'a',
        address: { city: 'Paris', zip: '75' },
      });
    });

    it('leaves plain fields alone', () => {
      expect(Serializer.unflatten({ a: 1, b: [1, 2] })).toEqual({ a: 1, b: [1, 2] });
    });
  });

  describe('toDocumentPath', () => {
    it('splits arrow notation into path segments', () => {
      expect(Serializer.toPathSegments('a@@@b@@@c')).toEqual(['a', 'b', 'c']);
    });
  });
});
