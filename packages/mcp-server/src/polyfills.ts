/**
 * Polyfill for URL.canParse
 *
 * The MCP SDK's OAuth handler uses URL.canParse in Zod schema validation.
 * Some environments (like certain Koa/Express proxy setups) may have a different
 * URL implementation that doesn't include the canParse static method
 * (added in Node.js 19.9.0 / 20.0.0).
 *
 * This polyfill must be imported BEFORE any MCP SDK imports.
 */

// Check if URL.canParse exists on the global URL
if (typeof URL.canParse !== 'function') {
  // Provide a fallback polyfill implementation
  (URL as unknown as { canParse: (url: string, base?: string) => boolean }).canParse = (
    url: string,
    base?: string,
  ): boolean => {
    try {
      // eslint-disable-next-line no-new
      new URL(url, base);

      return true;
    } catch {
      return false;
    }
  };
}

export {};
