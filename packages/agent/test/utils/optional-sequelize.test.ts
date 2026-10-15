import OptionsValidator from '../../src/utils/options-validator';

jest.mock('sequelize', () => {
  throw Object.assign(new Error("Cannot find module 'sequelize'"), { code: 'MODULE_NOT_FOUND' });
});

describe('without the optional sequelize peer installed', () => {
  const mandatoryOptions = {
    authSecret: '2536a2f786fc98a1ee62f9e9f405ff2521181cd01e15adcc',
    envSecret: '61a31971206f285c3e8eb8f3ee420175eb004bfa9fa24846dde6d5dd438e3991',
    isProduction: false,
  };

  test('loads the agent when the audit trail is off', () => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    expect(require('../../src').createAgent).toEqual(expect.any(Function));
  });

  test('names the packages to install when the audit trail is on', () => {
    expect(() =>
      OptionsValidator.withDefaults({
        ...mandatoryOptions,
        auditTrail: { connectionString: 'sqlite::memory:' },
      }),
    ).toThrow(
      'The audit trail requires the `sequelize` and `umzug` packages. ' +
        'Install them with `npm install sequelize umzug`.',
    );
  });
});
