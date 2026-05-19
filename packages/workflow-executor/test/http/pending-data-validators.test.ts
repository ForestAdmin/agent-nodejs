import patchBodySchemas from '../../src/http/pending-data-validators';

describe('patchBodySchemas', () => {
  describe('guidance', () => {
    const schema = patchBodySchemas.guidance;
    if (!schema) throw new Error('guidance schema not registered');

    it('accepts { userInput: "text" }', () => {
      expect(schema.parse({ userInput: 'some text' })).toEqual({ userInput: 'some text' });
    });

    it('accepts {} (userInput absent — user submitted without input)', () => {
      expect(schema.parse({})).toEqual({});
    });

    it('accepts { userInput: "" } (empty string)', () => {
      expect(schema.parse({ userInput: '' })).toEqual({ userInput: '' });
    });

    it('rejects unknown fields (strict schema)', () => {
      expect(() => schema.parse({ userInput: 'text', extra: 'leak' })).toThrow();
    });
  });

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

  describe('load-related-record', () => {
    const schema = patchBodySchemas['load-related-record'];
    if (!schema) throw new Error('load-related-record schema not registered');

    it('accepts confirmation with no overrides', () => {
      expect(schema.parse({ userConfirmed: true })).toEqual({ userConfirmed: true });
    });

    it('accepts confirmation with selectedRecordId override only', () => {
      expect(schema.parse({ userConfirmed: true, selectedRecordId: [42] })).toEqual({
        userConfirmed: true,
        selectedRecordId: [42],
      });
    });

    it('accepts confirmation with both name and selectedRecordId (relation override)', () => {
      expect(schema.parse({ userConfirmed: true, name: 'address', selectedRecordId: [7] })).toEqual(
        { userConfirmed: true, name: 'address', selectedRecordId: [7] },
      );
    });

    it('rejects name override without selectedRecordId — original record ID belongs to a different collection', () => {
      expect(() => schema.parse({ userConfirmed: true, name: 'address' })).toThrow(
        'selectedRecordId is required when overriding the relation name',
      );
    });

    it('rejects unknown fields (strict schema)', () => {
      expect(() => schema.parse({ userConfirmed: true, extra: 'leak' })).toThrow();
    });
  });
});
