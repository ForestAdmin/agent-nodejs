export const GUIDANCE_HTML_TAGS = [
  'p',
  'strong',
  'em',
  's',
  'a',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
];

const allowedInsideParagraphs = GUIDANCE_HTML_TAGS.filter(tag => tag !== 'p').map(tag =>
  tag === 'a' ? '<a href="...">' : `<${tag}>`,
);

export const GUIDANCE_HTML_RULE = `Wrap every paragraph in <p>, and use only ${allowedInsideParagraphs
  .slice(0, -1)
  .join(', ')} and ${allowedInsideParagraphs[allowedInsideParagraphs.length - 1]}.`;
