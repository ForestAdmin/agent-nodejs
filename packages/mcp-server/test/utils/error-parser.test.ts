import parseAgentError from '../../src/utils/error-parser';

describe('parseAgentError', () => {
  describe('nested error.text structure', () => {
    it('should parse error with nested error.text containing JSON:API errors', () => {
      const errorPayload = {
        error: {
          status: 400,
          text: JSON.stringify({
            errors: [{ name: 'ValidationError', detail: 'Invalid filters provided' }],
          }),
        },
      };
      const error = new Error(JSON.stringify(errorPayload));

      expect(parseAgentError(error)).toBe('Invalid filters provided');
    });

    it('should return null when error.text has no errors array', () => {
      const errorPayload = {
        error: {
          status: 400,
          text: JSON.stringify({ success: false }),
        },
      };
      const error = new Error(JSON.stringify(errorPayload));

      expect(parseAgentError(error)).toBeNull();
    });
  });

  describe('direct text property', () => {
    it('should parse error with direct text property containing JSON:API errors', () => {
      const errorPayload = {
        text: JSON.stringify({
          errors: [{ name: 'ValidationError', detail: 'Direct text error' }],
        }),
      };
      const error = new Error(JSON.stringify(errorPayload));

      expect(parseAgentError(error)).toBe('Direct text error');
    });

    it('should return null when text has no errors array', () => {
      const errorPayload = {
        text: JSON.stringify({ success: false }),
      };
      const error = new Error(JSON.stringify(errorPayload));

      expect(parseAgentError(error)).toBeNull();
    });
  });

  describe('message property fallback', () => {
    it('should use message property from parsed JSON when no text field', () => {
      const errorPayload = {
        message: 'Error message from JSON payload',
      };
      const error = new Error(JSON.stringify(errorPayload));

      expect(parseAgentError(error)).toBe('Error message from JSON payload');
    });
  });

  describe('plain error message fallback', () => {
    it('should fall back to error.message when message is not valid JSON', () => {
      const error = new Error('Plain error message');

      expect(parseAgentError(error)).toBe('Plain error message');
    });
  });

  describe('error priority', () => {
    it('should prioritize error.text over direct text', () => {
      const errorPayload = {
        error: {
          text: JSON.stringify({
            errors: [{ detail: 'From error.text' }],
          }),
        },
        text: JSON.stringify({
          errors: [{ detail: 'From direct text' }],
        }),
      };
      const error = new Error(JSON.stringify(errorPayload));

      expect(parseAgentError(error)).toBe('From error.text');
    });

    it('should prioritize text over message', () => {
      const errorPayload = {
        text: JSON.stringify({
          errors: [{ detail: 'From text' }],
        }),
        message: 'From message',
      };
      const error = new Error(JSON.stringify(errorPayload));

      expect(parseAgentError(error)).toBe('From text');
    });
  });

  describe('edge cases', () => {
    it('should return null for object without message property', () => {
      const error = { unknownProperty: 'some value' };

      expect(parseAgentError(error)).toBeNull();
    });

    it('should return null for null error', () => {
      expect(parseAgentError(null)).toBeNull();
    });

    it('should return null for undefined error', () => {
      expect(parseAgentError(undefined)).toBeNull();
    });

    it('should handle empty errors array', () => {
      const errorPayload = {
        error: {
          text: JSON.stringify({ errors: [] }),
        },
      };
      const error = new Error(JSON.stringify(errorPayload));

      expect(parseAgentError(error)).toBeNull();
    });

    it('should handle error without detail property', () => {
      const errorPayload = {
        error: {
          text: JSON.stringify({
            errors: [{ name: 'ValidationError' }],
          }),
        },
      };
      const error = new Error(JSON.stringify(errorPayload));

      expect(parseAgentError(error)).toBeNull();
    });
  });
});
