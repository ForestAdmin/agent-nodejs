import type { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

import sanitizeHtml from 'sanitize-html';

export default function sanitizeActionHtml(html: unknown): string | null {
  if (typeof html !== 'string') return null;

  const sanitized = sanitizeHtml(html);

  return sanitized === '' ? null : sanitized;
}

export function sanitizeActionLayout(
  layout: ForestServerActionFormLayoutElement[],
): ForestServerActionFormLayoutElement[] {
  return layout.map(element => {
    if (element.component === 'htmlBlock') {
      return { ...element, content: sanitizeActionHtml(element.content) ?? '' };
    }

    if (element.component === 'page') {
      return { ...element, elements: sanitizeActionLayout(element.elements) };
    }

    return element;
  });
}
