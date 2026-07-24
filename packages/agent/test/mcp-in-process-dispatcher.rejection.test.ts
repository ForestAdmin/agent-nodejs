import type { RequestListener } from 'http';

const mockInject = jest.fn();

jest.mock('light-my-request', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockInject(...args),
}));

// eslint-disable-next-line import/first
import InProcessDispatcher from '../src/mcp-in-process-dispatcher';

describe('InProcessDispatcher — injection rejection safety', () => {
  it('observes a late injection rejection (logs it) instead of leaking an unhandled rejection', async () => {
    const logger = jest.fn();
    // inject() rejects after the timeout has already won the race — the losing promise must not
    // become an unhandledRejection.
    mockInject.mockReturnValue(
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('inject blew up')), 30);
      }),
    );
    const dispatcher = new InProcessDispatcher(logger);
    dispatcher.setHandler((() => {}) as unknown as RequestListener);

    await expect(
      dispatcher.request({ method: 'get', path: '/x', headers: {}, timeoutMs: 10 }),
    ).rejects.toThrow(/timed out after 10ms/);

    await new Promise(resolve => {
      setTimeout(resolve, 40);
    });

    expect(logger).toHaveBeenCalledWith(
      'Warn',
      expect.stringContaining('settled after the 10ms timeout'),
    );
  });
});
