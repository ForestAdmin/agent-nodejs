import { GUIDANCE_HTML_TAGS, GUIDANCE_INLINE_TAGS } from './guidance-html-tags';

const HTML_ELEMENT_NAMES = [
  'abbr',
  'address',
  'area',
  'article',
  'aside',
  'audio',
  'b',
  'base',
  'bdi',
  'bdo',
  'big',
  'body',
  'button',
  'canvas',
  'caption',
  'center',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'datalist',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'embed',
  'fieldset',
  'figcaption',
  'figure',
  'font',
  'footer',
  'form',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'hr',
  'html',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'link',
  'main',
  'map',
  'mark',
  'menu',
  'meta',
  'meter',
  'nav',
  'noscript',
  'object',
  'optgroup',
  'option',
  'output',
  'picture',
  'pre',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  'samp',
  'script',
  'search',
  'section',
  'select',
  'slot',
  'small',
  'source',
  'span',
  'strike',
  'style',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'template',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'title',
  'tr',
  'track',
  'tt',
  'u',
  'var',
  'video',
  'wbr',
];

function tagPattern(names: string[], flags?: string): RegExp {
  return new RegExp(`</?(?:${names.join('|')})(?:\\s[^<>]*)?/?>`, flags);
}

// Only the lowercase tags a Guidance response may hold are read as markup, so text like
// `List<String>` or `Array<string>` stays as written. A value holding any other tag HTML defines
// is HTML written on purpose, and is kept as is rather than half stripped.
// Every scan stops at the next bracket or link, so a value full of unclosed tags is read in linear time.
const GUIDANCE_TAG = tagPattern([...GUIDANCE_HTML_TAGS, 'br'], 'g');
const OTHER_HTML_TAG = tagPattern(
  HTML_ELEMENT_NAMES.filter(name => !GUIDANCE_HTML_TAGS.includes(name)),
);
const LINE_BREAK = tagPattern(
  ['br', ...GUIDANCE_HTML_TAGS.filter(tag => !GUIDANCE_INLINE_TAGS.includes(tag))],
  'g',
);
const LINK = /<a\s[^<>]*?href=(?:"([^"<>]*)"|'([^'<>]*)')[^<>]*>((?:[^<]|<(?!\/?a[\s>]))*?)<\/a>/g;

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
      const text = html.replace(LINE_BREAK, '\n').replace(GUIDANCE_TAG, '');

      return text === href ? text : `${text} (${href})`;
    })
    .replace(LINE_BREAK, '\n')
    .replace(GUIDANCE_TAG, '')
    .replace(ENTITY, entity => ENTITIES[entity])
    .replace(/\n{2,}/g, '\n')
    .trim();
}
