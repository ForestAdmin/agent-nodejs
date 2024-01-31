import ResultBuilder from '../../../src/decorators/actions/result-builder';

describe('ResultBuilder', () => {
  const builder = new ResultBuilder();

  test('success', () => {
    expect(builder.success('Great!')).toEqual({
      type: 'Success',
      message: 'Great!',
      invalidated: new Set(),
      responseHeaders: {},
    });

    expect(builder.success('Great!', { html: '<div>That worked!</div>' })).toEqual({
      type: 'Success',
      message: 'Great!',
      html: '<div>That worked!</div>',
      invalidated: new Set(),
      responseHeaders: {},
    });

    expect(builder.setHeader('test', 'test').success('Great!')).toEqual({
      type: 'Success',
      message: 'Great!',
      invalidated: new Set(),
      responseHeaders: { test: 'test' },
    });
  });

  test('error', () => {
    expect(builder.error('booo')).toEqual({
      type: 'Error',
      message: 'booo',
      responseHeaders: {},
    });

    expect(builder.error('booo', { html: '<div>html content</div>' })).toEqual({
      type: 'Error',
      message: 'booo',
      html: '<div>html content</div>',
      responseHeaders: {},
    });

    expect(builder.setHeader('test', 'test').error('booo')).toEqual({
      type: 'Error',
      message: 'booo',
      responseHeaders: { test: 'test' },
    });
  });

  test('file', () => {
    let result = builder.file('col1,col2,col3', 'test.csv', 'text/csv');

    expect(result).toMatchObject({
      type: 'File',
      name: 'test.csv',
      mimeType: 'text/csv',
      responseHeaders: {},
    });

    result = builder.setHeader('test', 'test').file('col1,col2,col3', 'test.csv', 'text/csv');

    expect(result).toMatchObject({
      type: 'File',
      name: 'test.csv',
      mimeType: 'text/csv',
      responseHeaders: { test: 'test' },
    });
  });

  test('redirect', () => {
    expect(builder.redirectTo('/mypath')).toEqual({
      type: 'Redirect',
      path: '/mypath',
      responseHeaders: {},
    });

    expect(builder.setHeader('test', 'test').redirectTo('/mypath')).toEqual({
      type: 'Redirect',
      path: '/mypath',
      responseHeaders: { test: 'test' },
    });
  });

  test('webhook', () => {
    expect(builder.webhook('http://someurl')).toEqual({
      type: 'Webhook',
      url: 'http://someurl',
      method: 'POST',
      headers: {},
      body: {},
      responseHeaders: {},
    });

    expect(builder.setHeader('test', 'test').webhook('http://someurl')).toEqual({
      type: 'Webhook',
      url: 'http://someurl',
      method: 'POST',
      headers: {},
      body: {},
      responseHeaders: { test: 'test' },
    });
  });
});
