import sanitizeActionHtml from '../../src/action/sanitize-action-html';

jest.mock('sanitize-html', () => ({
  __esModule: true,
  default: Object.assign(
    jest.fn(() => {
      throw new Error('parser blew up');
    }),
    { defaults: jest.requireActual('sanitize-html').defaults },
  ),
}));

describe('sanitizeActionHtml', () => {
  it('drops the html and logs when the sanitizer throws', () => {
    const logger = jest.fn();

    expect(sanitizeActionHtml('<p>ok</p>', logger)).toBeNull();
    expect(logger).toHaveBeenCalledWith('Error', 'Action html dropped: sanitization failed', {
      cause: 'Error: parser blew up',
    });
  });
});
