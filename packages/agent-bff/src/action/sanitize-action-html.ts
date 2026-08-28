import sanitizeHtml from 'sanitize-html';

export default function sanitizeActionHtml(html: unknown): string | null {
  return typeof html === 'string' ? sanitizeHtml(html) : null;
}
