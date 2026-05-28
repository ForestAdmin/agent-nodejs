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

    it('accepts confirmation with both fieldDisplayName and selectedRecordId (relation override)', () => {
      expect(
        schema.parse({
          userConfirmed: true,
          fieldDisplayName: 'Address',
          selectedRecordId: [7],
        }),
      ).toEqual({ userConfirmed: true, fieldDisplayName: 'Address', selectedRecordId: [7] });
    });

    it('rejects fieldDisplayName override on confirm without selectedRecordId — original record ID belongs to a different collection', () => {
      expect(() => schema.parse({ userConfirmed: true, fieldDisplayName: 'Address' })).toThrow(
        'selectedRecordId is required when confirming with a relation override',
      );
    });

    it('rejects empty string fieldDisplayName — empty string is not a valid display name', () => {
      expect(() => schema.parse({ userConfirmed: true, fieldDisplayName: '' })).toThrow();
    });

    it('rejects unknown fields (strict schema)', () => {
      expect(() => schema.parse({ userConfirmed: true, extra: 'leak' })).toThrow();
    });

    // Preview patch: fieldDisplayName alone, no userConfirmed. The executor uses this
    // to re-list candidates for a different relation without finalizing the step.
    it('accepts a preview patch — fieldDisplayName alone, no userConfirmed', () => {
      expect(schema.parse({ fieldDisplayName: 'Address' })).toEqual({
        fieldDisplayName: 'Address',
      });
    });

    it('rejects an empty patch — must carry either userConfirmed or a fieldDisplayName preview', () => {
      expect(() => schema.parse({})).toThrow();
    });
  });
});
