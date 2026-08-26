export function stubFetch(response: unknown): jest.Mock {
  const stub = jest.fn().mockResolvedValue(response);

  global.fetch = stub as unknown as typeof fetch;

  return stub;
}

export function rejectFetch(error: unknown): jest.Mock {
  const stub = jest.fn().mockRejectedValue(error);

  global.fetch = stub as unknown as typeof fetch;

  return stub;
}

export function stubEnvironmentIdFetch(): jest.Mock {
  return stubFetch({
    ok: true,
    status: 200,
    statusText: 'ok',
    json: async () => ({ data: { id: '42' } }),
  });
}

export function restoreFetchAfterEach(): void {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });
}
