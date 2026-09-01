import type { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

import sanitizeHtml from 'sanitize-html';

const SAFE_STYLE_VALUE = /^[^;{}()]*$/;

const ALLOWED_STYLE_PROPERTIES = [
  'background',
  'background-color',
  'border',
  'border-bottom',
  'border-collapse',
  'border-left',
  'border-radius',
  'border-right',
  'border-top',
  'color',
  'display',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'letter-spacing',
  'line-height',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-width',
  'min-width',
  'opacity',
  'overflow',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'text-align',
  'text-decoration',
  'text-transform',
  'vertical-align',
  'white-space',
  'width',
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['style'] },
  allowedStyles: {
    '*': Object.fromEntries(ALLOWED_STYLE_PROPERTIES.map(name => [name, [SAFE_STYLE_VALUE]])),
  },
};

function sanitize(html: unknown): string {
  return typeof html === 'string' ? sanitizeHtml(html, OPTIONS) : '';
}

export default function sanitizeActionHtml(html: unknown): string | null {
  return sanitize(html) || null;
}

export function sanitizeActionLayout(
  layout: ForestServerActionFormLayoutElement[],
): ForestServerActionFormLayoutElement[] {
  return layout.map(element => {
    if (element?.component === 'htmlBlock') {
      return { ...element, content: sanitize(element.content) };
    }

    if (element?.component === 'page' && Array.isArray(element.elements)) {
      return { ...element, elements: sanitizeActionLayout(element.elements) };
    }

    return element;
  });
}
