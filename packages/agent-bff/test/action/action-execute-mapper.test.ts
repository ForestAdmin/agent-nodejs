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
      body: {
        type: 'success',
        message: 'Done',
        invalidated: ['orders', 'items'],
        html: '<b>ok</b>',
      },
    });
  });

  it('sanitizes the success html: safe markup kept, active markup stripped', () => {
    expect(
      mapActionExecuteResult({
        success: 'With html',
        html:
          '<p>Safe <b>markup</b></p>' +
          '<script>alert(1)</script>' +
          '<img src=x onerror="parent.postMessage({qa:xss},\'*\')">' +
          '<svg onload="alert(1)"></svg>' +
          '<a href="javascript:alert(2)">click</a>',
        refresh: { relationships: [] },
      }),
    ).toEqual({
      status: 200,
      body: {
        type: 'success',
        message: 'With html',
        invalidated: [],
        html: '<p>Safe <b>markup</b></p><a>click</a>',
      },
    });
  });

  it('keeps presentational inline styles on the success html', () => {
    expect(
      mapActionExecuteResult({
        success: 'KYC Approved',
        html: '<div style="background:#16a34a;color:#fff">ok</div><div style="position:fixed">x</div>',
        refresh: { relationships: [] },
      }).body,
    ).toEqual({
      type: 'success',
      message: 'KYC Approved',
      invalidated: [],
      html: '<div style="background:#16a34a;color:#fff">ok</div><div>x</div>',
    });
  });

  it('maps an html that is entirely active markup to null rather than an empty string', () => {
    expect(
      mapActionExecuteResult({
        success: 'ok',
        html: '<script>alert(1)</script>',
        refresh: { relationships: [] },
      }),
    ).toEqual({
      status: 200,
      body: { type: 'success', message: 'ok', invalidated: [], html: null },
    });
  });

  it('maps a non-string html to null instead of relaying or crashing on it', () => {
    expect(
      mapActionExecuteResult({ success: 'ok', html: 42, refresh: { relationships: [] } }),
    ).toEqual({
      status: 200,
      body: { type: 'success', message: 'ok', invalidated: [], html: null },
    });
  });

  it('defaults message and html to null and invalidated to [] when absent', () => {
    expect(mapActionExecuteResult({ success: undefined, refresh: { relationships: [] } })).toEqual({
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

  it.each([
    ['relationships absent', { success: 'ok', refresh: {} }],
    ['relationships not an array', { success: 'ok', refresh: { relationships: 'x' } }],
  ])('falls back invalidated to [] when %s', (_label, payload) => {
    expect(mapActionExecuteResult(payload)).toEqual({
      status: 200,
      body: { type: 'success', message: 'ok', invalidated: [], html: null },
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

  it.each([
    ['an empty object', { webhook: {} }],
    ['an array', { webhook: [] }],
    ['url missing', { webhook: { method: 'POST' } }],
    ['method missing', { webhook: { url: 'https://x.test' } }],
    ['url not a string', { webhook: { url: 42, method: 'POST' } }],
  ])('falls through to 501 when the webhook payload is %s', (_label, payload) => {
    expect(mapActionExecuteResult(payload)).toEqual({
      status: 501,
      body: { error: { type: 'unsupported_action_result', status: 501 } },
    });
  });

  it.each([
    ['an array', { refresh: [] }],
    ['an object without relationships', { refresh: {} }],
    ['relationships not an array', { refresh: { relationships: 'x' } }],
  ])('falls through to 501 when the only marker is a refresh that is %s', (_label, payload) => {
    expect(mapActionExecuteResult(payload)).toEqual({
      status: 501,
      body: { error: { type: 'unsupported_action_result', status: 501 } },
    });
  });

  it('drops non-string entries from invalidated', () => {
    expect(
      mapActionExecuteResult({ success: 'ok', refresh: { relationships: ['orders', 42, null] } }),
    ).toEqual({
      status: 200,
      body: { type: 'success', message: 'ok', invalidated: ['orders'], html: null },
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

  it.each([
    ['a null webhook', { webhook: null }],
    ['a non-string redirectTo', { redirectTo: {} }],
    ['a non-string success with no refresh', { success: {} }],
  ])('falls through to 501 for a malformed payload: %s', (_label, payload) => {
    expect(mapActionExecuteResult(payload)).toEqual({
      status: 501,
      body: { error: { type: 'unsupported_action_result', status: 501 } },
    });
  });
});
