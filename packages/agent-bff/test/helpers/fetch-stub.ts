function installFetch(stub: jest.Mock): jest.Mock {
  global.fetch = stub as unknown as typeof fetch;

  return stub;
}

export function stubFetch(response: unknown): jest.Mock {
  return installFetch(jest.fn().mockResolvedValue(response));
}

export function rejectFetch(error: unknown): jest.Mock {
  return installFetch(jest.fn().mockRejectedValue(error));
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
