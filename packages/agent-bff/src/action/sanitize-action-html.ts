import type { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

import sanitizeHtml from 'sanitize-html';

function sanitize(html: unknown): string {
  return typeof html === 'string' ? sanitizeHtml(html) : '';
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
