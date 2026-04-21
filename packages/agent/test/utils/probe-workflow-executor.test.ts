import probeWorkflowExecutor from '../../src/utils/probe-workflow-executor';

describe('probeWorkflowExecutor', () => {
  let fetchSpy: jest.SpyInstance;
  const logger = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(jest.fn());
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('logs Info when the executor /health endpoint returns 200', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

    await probeWorkflowExecutor('http://localhost:3400', logger);

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3400/health',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(logger).toHaveBeenCalledWith(
      'Info',
      'Workflow executor is reachable at http://localhost:3400',
    );
  });

  it('strips a trailing slash from the configured URL before appending /health', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

    await probeWorkflowExecutor('http://localhost:3400/', logger);

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3400/health',
      expect.anything(),
    );
  });

  it('logs Warn with status code when the executor responds non-2xx', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 503, statusText: 'Service Unavailable' }));

    await probeWorkflowExecutor('http://localhost:3400', logger);

    expect(logger).toHaveBeenCalledWith(
      'Warn',
      expect.stringContaining('responded with 503 Service Unavailable'),
    );
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      expect.stringContaining('Workflow routes may return errors until the executor is healthy'),
    );
  });

  it('logs Warn with the network error message when fetch throws', async () => {
    fetchSpy.mockRejectedValue(
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3400'), { code: 'ECONNREFUSED' }),
    );

    await probeWorkflowExecutor('http://localhost:3400', logger);

    expect(logger).toHaveBeenCalledWith(
      'Warn',
      expect.stringContaining('cannot reach http://localhost:3400 (connect ECONNREFUSED 127.0.0.1:3400)'),
    );
  });

  it('logs Warn with "timeout" when fetch is aborted by the 5s signal', async () => {
    const timeoutError = new Error('The operation was aborted');
    timeoutError.name = 'TimeoutError';
    fetchSpy.mockRejectedValue(timeoutError);

    await probeWorkflowExecutor('http://localhost:3400', logger);

    expect(logger).toHaveBeenCalledWith(
      'Warn',
      expect.stringContaining('timeout after 5000ms'),
    );
  });

  it('never throws — resolves even when the executor is unreachable', async () => {
    fetchSpy.mockRejectedValue(new Error('boom'));

    await expect(probeWorkflowExecutor('http://localhost:3400', logger)).resolves.toBeUndefined();
  });

  it('passes an AbortSignal with 5s timeout to fetch', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

    await probeWorkflowExecutor('http://localhost:3400', logger);

    const call = fetchSpy.mock.calls[0];
    const init = call[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
