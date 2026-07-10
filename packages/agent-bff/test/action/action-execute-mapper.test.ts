import { mapActionExecuteResult } from '../../src/action/action-execute-mapper';

describe('mapActionExecuteResult', () => {
  it('maps a Success payload, serializing refresh.relationships into invalidated', () => {
    expect(
      mapActionExecuteResult({
        success: 'Done',
        html: '<b>ok</b>',
        refresh: { relationships: ['orders', 'items'] },
      }),
    ).toEqual({
      status: 200,
      body: { type: 'success', message: 'Done', invalidated: ['orders', 'items'], html: '<b>ok</b>' },
    });
  });

  it('defaults message and html to null and invalidated to [] when absent', () => {
    expect(mapActionExecuteResult({ success: undefined })).toEqual({
      status: 200,
      body: { type: 'success', message: null, invalidated: [], html: null },
    });
  });

  it('treats a bare refresh payload as a Success', () => {
    expect(mapActionExecuteResult({ refresh: { relationships: ['orders'] } })).toEqual({
      status: 200,
      body: { type: 'success', message: null, invalidated: ['orders'], html: null },
    });
  });

  it('maps a Webhook payload verbatim', () => {
    expect(
      mapActionExecuteResult({
        webhook: { url: 'https://x.test', method: 'POST', headers: { a: '1' }, body: { b: 2 } },
      }),
    ).toEqual({
      status: 200,
      body: {
        type: 'webhook',
        url: 'https://x.test',
        method: 'POST',
        headers: { a: '1' },
        body: { b: 2 },
      },
    });
  });

  it('maps a Redirect payload to the path', () => {
    expect(mapActionExecuteResult({ redirectTo: '/orders/1' })).toEqual({
      status: 200,
      body: { type: 'redirect', path: '/orders/1' },
    });
  });

  it('falls through to 501 for an unrecognized (File) payload', () => {
    expect(mapActionExecuteResult({})).toEqual({
      status: 501,
      body: { error: { type: 'unsupported_action_result', status: 501 } },
    });
  });

  it('falls through to 501 for a non-object payload', () => {
    expect(mapActionExecuteResult(null)).toEqual({
      status: 501,
      body: { error: { type: 'unsupported_action_result', status: 501 } },
    });
  });
});
