import sanitizeHtml from 'sanitize-html';

import sanitizeActionHtml from '../../src/action/sanitize-action-html';

jest.mock('sanitize-html', () => {
  const actual = jest.requireActual('sanitize-html');

  return {
    __esModule: true,
    default: Object.assign(jest.fn(actual), { defaults: actual.defaults }),
  };
});

describe('sanitizeActionHtml', () => {
  it('drops the html and logs when the sanitizer throws', () => {
    jest.mocked(sanitizeHtml).mockImplementationOnce(() => {
      throw new Error('parser blew up');
    });
    const logger = jest.fn();

    expect(sanitizeActionHtml('<p>ok</p>', logger)).toBeNull();
    expect(logger).toHaveBeenCalledWith('Error', 'Action html dropped: sanitization failed', {
      cause: 'Error: parser blew up',
    });
  });

  it('neutralises a non-allowed tag smuggled after a solidus-closed textarea (GHSA-jxwj-j7wr-gfrw)', () => {
    const html = sanitizeActionHtml(
      '<p>kept</p><textarea></textarea/><img src=x onerror="alert(document.domain)">',
      jest.fn(),
    );

    expect(html).toBe('<p>kept</p>');
  });

  it('neutralises a javascript: destination in an SVG SMIL href animation (GHSA-g8qq-57p8-ggw5)', () => {
    const html = sanitizeActionHtml(
      '<svg><a><animate attributeName="href" values="#safe;javascript:alert(\'XSS\')" ' +
        'dur=".01s" fill="freeze"></animate><set attributeName="href" to="javascript:alert(1)">' +
        '</set><text y="30">Click me</text></a></svg>',
      jest.fn(),
    );

    expect(html).toBe('<a>Click me</a>');
  });
});
