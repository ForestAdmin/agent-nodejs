import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import getAuthContext from '../../src/utils/auth-context';

describe('getAuthContext', () => {
  const createRequest = (extra: Record<string, unknown> | undefined) =>
    ({
      authInfo: extra === undefined ? undefined : { extra },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>);

  it('should return the forestServerToken and renderingId from authInfo.extra', () => {
    const request = createRequest({ forestServerToken: 'forest-token', renderingId: '123' });

    expect(getAuthContext(request)).toEqual({
      forestServerToken: 'forest-token',
      renderingId: '123',
    });
  });

  it('should convert a numeric renderingId (from the JWT) to a string', () => {
    const request = createRequest({ forestServerToken: 'forest-token', renderingId: 456 });

    expect(getAuthContext(request)).toEqual({
      forestServerToken: 'forest-token',
      renderingId: '456',
    });
  });

  it('should throw when forestServerToken is missing', () => {
    const request = createRequest({ renderingId: '123' });

    expect(() => getAuthContext(request)).toThrow(
      'Invalid or missing forestServerToken in authentication context',
    );
  });

  it('should throw when forestServerToken is not a string', () => {
    const request = createRequest({ forestServerToken: 42, renderingId: '123' });

    expect(() => getAuthContext(request)).toThrow(
      'Invalid or missing forestServerToken in authentication context',
    );
  });

  it('should throw when renderingId is missing', () => {
    const request = createRequest({ forestServerToken: 'forest-token' });

    expect(() => getAuthContext(request)).toThrow(
      'Invalid or missing renderingId in authentication context',
    );
  });

  it('should throw when renderingId is null', () => {
    const request = createRequest({ forestServerToken: 'forest-token', renderingId: null });

    expect(() => getAuthContext(request)).toThrow(
      'Invalid or missing renderingId in authentication context',
    );
  });

  it('should throw when authInfo is absent entirely', () => {
    const request = createRequest(undefined);

    expect(() => getAuthContext(request)).toThrow(
      'Invalid or missing forestServerToken in authentication context',
    );
  });
});
