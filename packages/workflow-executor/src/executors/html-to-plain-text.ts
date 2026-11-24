// Only the tags a Guidance response may hold are read as markup: anything else between brackets,
// like `List<String>` or `a < b`, is text and must stay as written.
const FORMATTING_TAG = /<\/?(?:p|strong|em|s|a|h[1-3]|ul|ol|li|blockquote)(?:\s[^>]*)?>|<br\s*\/?>/i;
const LINK = /<a\s[^>]*?href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
const LINE_BREAK = /<br\s*\/?>|<\/(?:p|h[1-3]|li|blockquote)>/gi;
const REMAINING_TAG = /<\/?(?:p|strong|em|s|a|h[1-3]|ul|ol|li|blockquote)(?:\s[^>]*)?>/gi;

const ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&amp;': '&',
};

export default function htmlToPlainText(value: string): string {
  if (!FORMATTING_TAG.test(value)) return value;

  return value
    .replace(LINK, (_, href: string, text: string) => (text === href ? text : `${text} (${href})`))
    .replace(LINE_BREAK, '\n')
    .replace(REMAINING_TAG, '')
    .replace(/&(?:lt|gt|quot|#39|nbsp|amp);/g, entity => ENTITIES[entity])
    .replace(/\n{2,}/g, '\n')
    .trim();
}
