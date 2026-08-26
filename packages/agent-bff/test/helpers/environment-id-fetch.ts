export function stubEnvironmentIdFetch(): jest.Mock {
  const stub = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'ok',
    json: async () => ({ data: { id: '42' } }),
  });

  global.fetch = stub as unknown as typeof fetch;

  return stub;
}

export function restoreFetch(original: typeof global.fetch): void {
  global.fetch = original;
}
