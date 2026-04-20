import patchBodySchemas from '../src/pending-data-validators';

describe('patchBodySchemas', () => {
  describe('trigger-action', () => {
    const schema = patchBodySchemas['trigger-action'];
    if (!schema) throw new Error('trigger-action schema not registered');

    it('accepts { userConfirmed: true, actionResult: <opaque> }', () => {
      const parsed = schema.parse({
        userConfirmed: true,
        actionResult: { success: 'ok', html: '<p>done</p>' },
      });

      expect(parsed).toEqual({
        userConfirmed: true,
        actionResult: { success: 'ok', html: '<p>done</p>' },
      });
    });

    it('accepts { userConfirmed: true, actionResult: null } (void action)', () => {
      const parsed = schema.parse({ userConfirmed: true, actionResult: null });

      expect(parsed).toEqual({ userConfirmed: true, actionResult: null });
    });

    it('accepts { userConfirmed: false } without actionResult (skip flow)', () => {
      const parsed = schema.parse({ userConfirmed: false });

      expect(parsed).toEqual({ userConfirmed: false });
    });

    it('rejects unknown fields (strict schema)', () => {
      expect(() =>
        schema.parse({ userConfirmed: true, actionResult: {}, extra: 'leak' }),
      ).toThrow();
    });

    it('rejects missing userConfirmed', () => {
      expect(() => schema.parse({ actionResult: {} })).toThrow();
    });

    it('rejects non-boolean userConfirmed', () => {
      expect(() => schema.parse({ userConfirmed: 'yes' })).toThrow();
    });
  });
});
