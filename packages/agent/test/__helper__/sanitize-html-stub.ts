function sanitizeHtml(): never {
  throw new Error('sanitize-html is stubbed in the agent tests');
}

sanitizeHtml.defaults = { allowedAttributes: {} };

export = sanitizeHtml;
