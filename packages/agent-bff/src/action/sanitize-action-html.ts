import sanitizeHtml from 'sanitize-html';

/**
 * The agent's action-result html is untrusted output: an action can interpolate record data into
 * it, so the BFF sanitizes it at this trust boundary before relaying (PRD-1095). The library's
 * default allowlist keeps rich text (paragraphs, emphasis, links, tables, lists) and drops active
 * content: script/style/iframe/svg/img tags, on* attributes, javascript:/data: URLs. A non-string
 * value is an unchecked agent-JSON cast, not html: null is relayed instead of throwing inside the
 * sanitizer.
 */
export default function sanitizeActionHtml(html: unknown): string | null {
  return typeof html === 'string' ? sanitizeHtml(html) : null;
}
