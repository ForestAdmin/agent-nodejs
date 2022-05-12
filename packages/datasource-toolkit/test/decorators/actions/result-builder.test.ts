import ResultBuilder from '../../../src/decorators/actions/result-builder';

describe('ResultBuilder', () => {
  const builder = new ResultBuilder();

  test('success', () => {
    expect(builder.success('Great!')).toEqual({
      type: 'Success',
      message: 'Great!',
      format: 'text',
      invalidated: new Set(),
    });
  });

  test('error', () => {
    expect(builder.error('booo')).toEqual({
      type: 'Error',
      message: 'booo',
    });
  });

  test('file', () => {
    const result = builder.file('col1,col2,col3', 'test.csv', 'text/csv');

    expect(result).toMatchObject({
      type: 'File',
      name: 'test.csv',
      mimeType: 'text/csv',
    });
  });

  test('redirect', () => {
    expect(builder.redirectTo('/mypath')).toEqual({
      type: 'Redirect',
      path: '/mypath',
    });
  });

  test('webhook', () => {
    expect(builder.webhook('http://someurl')).toEqual({
      type: 'Webhook',
      url: 'http://someurl',
      method: 'POST',
      headers: {},
      body: {},
    });
  });
});
