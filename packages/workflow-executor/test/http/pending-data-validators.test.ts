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

  describe('update-record', () => {
    const schema = patchBodySchemas['update-record'];
    if (!schema) throw new Error('update-record schema not registered');

    it('accepts { userConfirmed: true } without value (AI-proposed value kept)', () => {
      expect(schema.parse({ userConfirmed: true })).toEqual({ userConfirmed: true });
    });

    it('accepts string value override', () => {
      expect(schema.parse({ userConfirmed: true, value: 'new' })).toEqual({
        userConfirmed: true,
        value: 'new',
      });
    });

    it('accepts number value override', () => {
      expect(schema.parse({ userConfirmed: true, value: 42 })).toEqual({
        userConfirmed: true,
        value: 42,
      });
    });

    it('accepts empty string value', () => {
      expect(schema.parse({ userConfirmed: true, value: '' })).toEqual({
        userConfirmed: true,
        value: '',
      });
    });

    it('accepts zero value', () => {
      expect(schema.parse({ userConfirmed: true, value: 0 })).toEqual({
        userConfirmed: true,
        value: 0,
      });
    });

    // value is now z.unknown(): the HTTP schema no longer judges the business type.
    // The update-record executor coerces/validates it field-aware (buildZodSchemaForField).
    it('accepts boolean value (coerced field-aware downstream)', () => {
      expect(schema.parse({ userConfirmed: true, value: true })).toEqual({
        userConfirmed: true,
        value: true,
      });
    });

    it('accepts array value (coerced field-aware downstream)', () => {
      expect(schema.parse({ userConfirmed: true, value: [1, 2] })).toEqual({
        userConfirmed: true,
        value: [1, 2],
      });
    });

    it('accepts null value', () => {
      expect(schema.parse({ userConfirmed: true, value: null })).toEqual({
        userConfirmed: true,
        value: null,
      });
    });

    it('accepts object value (coerced field-aware downstream)', () => {
      expect(schema.parse({ userConfirmed: true, value: { foo: 'bar' } })).toEqual({
        userConfirmed: true,
        value: { foo: 'bar' },
      });
    });

    it('rejects missing userConfirmed', () => {
      expect(() => schema.parse({ value: 'x' })).toThrow();
    });

    it('rejects unknown fields (strict schema)', () => {
      expect(() => schema.parse({ userConfirmed: true, value: 'x', extra: 'leak' })).toThrow();
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

    it('deserializes selectedRecordId from pipe string to array', () => {
      const result = schema.parse({ userConfirmed: true, selectedRecordId: 'pk1|pk2' }) as {
        selectedRecordId: unknown;
      };

      expect(result.selectedRecordId).toEqual(['pk1', 'pk2']);
    });

    it('deserializes single selectedRecordId', () => {
      const result = schema.parse({ userConfirmed: true, selectedRecordId: '42' }) as {
        selectedRecordId: unknown;
      };

      expect(result.selectedRecordId).toEqual(['42']);
    });

    it('accepts confirmation with both fieldName and selectedRecordId (relation override)', () => {
      const result = schema.parse({
        userConfirmed: true,
        fieldName: 'address',
        selectedRecordId: '7',
      }) as { selectedRecordId: unknown };

      expect(result).toMatchObject({ userConfirmed: true, fieldName: 'address' });
      expect(result.selectedRecordId).toEqual(['7']);
    });

    it('rejects fieldName override on confirm without selectedRecordId — original record ID belongs to a different collection', () => {
      expect(() => schema.parse({ userConfirmed: true, fieldName: 'address' })).toThrow(
        'selectedRecordId is required when confirming with a relation override',
      );
    });

    it('rejects empty string fieldName — empty string is not a valid field name', () => {
      expect(() => schema.parse({ userConfirmed: true, fieldName: '' })).toThrow();
    });

    it('rejects empty selectedRecordId string', () => {
      expect(() => schema.parse({ userConfirmed: true, selectedRecordId: '' })).toThrow();
    });

    it('rejects unknown fields (strict schema)', () => {
      expect(() => schema.parse({ userConfirmed: true, extra: 'leak' })).toThrow();
    });

    // Preview patch: fieldName alone, no userConfirmed. The executor uses this to
    // re-list candidates for a different relation without finalizing the step.
    it('accepts a preview patch — fieldName alone, no userConfirmed', () => {
      expect(schema.parse({ fieldName: 'address' })).toEqual({
        fieldName: 'address',
      });
    });

    it('rejects an empty patch — must carry either userConfirmed or a fieldName preview', () => {
      expect(() => schema.parse({})).toThrow();
    });
  });
});
