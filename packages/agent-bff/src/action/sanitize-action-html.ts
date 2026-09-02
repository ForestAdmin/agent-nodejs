import type { Logger } from '../ports/logger-port';
import type { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

import sanitizeHtml from 'sanitize-html';

const MAX_HTML_CHARACTERS = 256 * 1024;

const MAX_LAYOUT_DEPTH = 10;

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

function sanitize(html: unknown, logger: Logger): string | null {
  if (typeof html !== 'string') return null;

  let bounded = html;

  if (bounded.length > MAX_HTML_CHARACTERS) {
    logger('Warn', 'Action html truncated: longer than the sanitizable size', {
      characters: bounded.length,
      limit: MAX_HTML_CHARACTERS,
    });

    bounded = bounded.slice(0, MAX_HTML_CHARACTERS);
  }

  try {
    return sanitizeHtml(bounded, OPTIONS) || null;
  } catch (error) {
    logger('Error', 'Action html dropped: sanitization failed', { cause: String(error) });

    return null;
  }
}

export default function sanitizeActionHtml(html: unknown, logger: Logger): string | null {
  return sanitize(html, logger);
}

export function sanitizeActionLayout(
  layout: ForestServerActionFormLayoutElement[],
  logger: Logger,
  depth = 0,
): ForestServerActionFormLayoutElement[] {
  return layout.map(element => {
    if (element?.component === 'htmlBlock') {
      return { ...element, content: sanitize(element.content, logger) ?? '' };
    }

    if (element?.component === 'page' && Array.isArray(element.elements)) {
      if (depth >= MAX_LAYOUT_DEPTH) {
        logger('Warn', 'Action layout elements dropped: nested deeper than the sanitizable depth', {
          limit: MAX_LAYOUT_DEPTH,
        });

        return { ...element, elements: [] };
      }

      return { ...element, elements: sanitizeActionLayout(element.elements, logger, depth + 1) };
    }

    return element;
  });
}
