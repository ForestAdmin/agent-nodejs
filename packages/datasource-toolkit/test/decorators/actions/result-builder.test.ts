import { ActionResultType } from '../../../src/interfaces/action';
import ResultBuilder from '../../../src/decorators/actions/result-builder';

/** Useless file. This is just there to please code climate */
describe('ResponseBuilder', () => {
  const builder = new ResultBuilder();

  test('success', () => {
    expect(builder.success('Great!')).toEqual({
      type: ActionResultType.Success,
      message: 'Great!',
      format: 'text',
      invalidated: new Set(),
    });
  });

  test('error', () => {
    expect(builder.error('booo')).toEqual({
      type: ActionResultType.Error,
      message: 'booo',
    });
  });

  test('file', () => {
    const result = builder.file('col1,col2,col3', 'test.csv', 'text/csv');

    expect(result).toMatchObject({
      type: ActionResultType.File,
      name: 'test.csv',
      mimeType: 'text/csv',
    });
  });

  test('redirect', () => {
    expect(builder.redirectTo('/mypath')).toEqual({
      type: ActionResultType.Redirect,
      path: '/mypath',
    });
  });

  test('webhook', () => {
    expect(builder.webhook('http://someurl')).toEqual({
      type: ActionResultType.Webhook,
      url: 'http://someurl',
      method: 'POST',
      headers: {},
      body: {},
    });
  });
});
