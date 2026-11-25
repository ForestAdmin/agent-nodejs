// Only the lowercase tags a Guidance response may hold are read as markup, so text like
// `List<String>` or `Option<A>` stays as written. A value holding any other tag is HTML written on
// purpose, and is kept as is rather than half stripped.
const GUIDANCE_TAG_NAME = 'p|strong|em|s|a|h[1-3]|ul|ol|li|blockquote|br';
const GUIDANCE_TAG = new RegExp(`</?(?:${GUIDANCE_TAG_NAME})(?:\\s[^>]*)?/?>`, 'g');
const OTHER_TAG = new RegExp(`</?(?!(?:${GUIDANCE_TAG_NAME})\\b)[a-z][a-z0-9]*(?:\\s[^>]*)?/?>`);
const LINK = /<a\s[^>]*?href=(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/g;
const LINE_BREAK = /<br\s*\/?>|<\/(?:p|h[1-3]|li|blockquote)>/g;

const ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&amp;': '&',
};
const ENTITY = new RegExp(Object.keys(ENTITIES).join('|'), 'g');

export default function htmlToPlainText(value: string): string {
  if (value.search(GUIDANCE_TAG) === -1 || OTHER_TAG.test(value)) return value;

  return value
    .replace(LINK, (_, doubleQuotedHref?: string, singleQuotedHref?: string, html = '') => {
      const href = doubleQuotedHref ?? singleQuotedHref;
      const text = html.replace(GUIDANCE_TAG, '');

      return text === href ? text : `${text} (${href})`;
    })
    .replace(LINE_BREAK, '\n')
    .replace(GUIDANCE_TAG, '')
    .replace(ENTITY, entity => ENTITIES[entity])
    .replace(/\n{2,}/g, '\n')
    .trim();
}
