import executeCommand from './mocks/commander-mock';
import readlineMock from './mocks/readline-mock';
import { consoleMocks } from './test-setup';

describe('bootstrap', () => {
  it('first test', async () => {
    await executeCommand([
      'bootstrap',
      '--env-secret',
      'd4ae505b138c30f2d70952421d738627d65ca5322a27431d067479932cebcfa2',
    ]);

    expect(consoleMocks.log).toHaveBeenCalledWith(
      '\n- Last code pushed a few seconds ago, by some developer (some.dev@forestadmin.com).',
    );

    expect(readlineMock.question).toHaveBeenCalledWith(
      `Do you really want to overwrite these customizations? (yes/no) `,
      expect.objectContaining({}),
    );
  });
});
