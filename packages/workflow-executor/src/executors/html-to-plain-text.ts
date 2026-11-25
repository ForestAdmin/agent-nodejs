import { GUIDANCE_HTML_TAGS } from './guidance-html-tags';

// Only the lowercase tags a Guidance response may hold are read as markup, so text like
// `List<String>` or `Array<string>` stays as written. A value holding a tag HTML defines beyond
// those is HTML written on purpose, and is kept as is rather than half stripped.
// Every scan stops at the next bracket, so text the AI fills with unclosed tags is read in linear time.
const GUIDANCE_TAG = new RegExp(
  `</?(?:${[...GUIDANCE_HTML_TAGS, 'br'].join('|')})(?:\\s[^<>]*)?/?>`,
  'g',
);
const OTHER_HTML_TAG =
  /<\/?(?:div|span|table|thead|tbody|tfoot|tr|td|th|img|u|b|i|code|pre|h[4-6]|hr|font|sub|sup|del|ins|dl|dt|dd|style|script|iframe|html|body)(?:\s[^<>]*)?\/?>/;
const LINK = /<a\s[^<>]*?href=(?:"([^"<>]*)"|'([^'<>]*)')[^<>]*>([\s\S]*?)<\/a>/g;
const LINE_BREAK = /<br\s*\/?>|<\/(?:p|h[1-3]|li|blockquote)>|<(?:ul|ol)(?:\s[^<>]*)?>/g;

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
  if (value.search(GUIDANCE_TAG) === -1 || OTHER_HTML_TAG.test(value)) return value;

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
