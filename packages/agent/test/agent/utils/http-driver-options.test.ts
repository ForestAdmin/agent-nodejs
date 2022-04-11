import OptionsUtils from '../../../src/agent/utils/http-driver-options';

describe('OptionsUtils', () => {
  const mandatoryOptions = {
    agentUrl: 'http://localhost:3351',
    authSecret: '2536a2f786fc98a1ee62f9e9f405ff2521181cd01e15adcc',
    envSecret: '61a31971206f285c3e8eb8f3ee420175eb004bfa9fa24846dde6d5dd438e3991',
    isProduction: false,
  };

  describe('withDefaults', () => {
    test('should add default values when they are missing', () => {
      const options = OptionsUtils.withDefaults(mandatoryOptions);

      expect(options).toHaveProperty('clientId', null);
      expect(options).toHaveProperty('forestServerUrl', 'https://api.forestadmin.com');
      expect(options).toHaveProperty('logger');
      expect(options).toHaveProperty('prefix', '/forest');
      expect(options).toHaveProperty('schemaPath', '.forestadmin-schema.json');
    });

    test('logger should be callable', () => {
      jest.spyOn(console, 'error').mockReturnValue();

      const options = OptionsUtils.withDefaults(mandatoryOptions);

      options.logger('info', 'hello!');
      expect(console.error).toHaveBeenCalled();
    });

    test('should not overwrite existing values', () => {
      const options = OptionsUtils.withDefaults({
        ...mandatoryOptions,
        forestServerUrl: 'https://api.development.forestadmin.com',
      });

      expect(options).toHaveProperty('forestServerUrl', 'https://api.development.forestadmin.com');
    });
  });

  describe('OptionsValidator.validate', () => {
    const allOptions = {
      ...mandatoryOptions,
      clientId: null as string,
      forestServerUrl: 'https://api.development.forestadmin.com',
      logger: () => {},
      prefix: '/forest',
      schemaPath: '.forestadmin-schema.json',
      permissionsCacheDurationInSeconds: 12,
    };

    test('should work with good format', () => {
      expect(() => OptionsUtils.validate(allOptions)).not.toThrow();
    });

    describe('schemaPath', () => {
      test('should fail on a folder which does not exists', () => {
        expect(() =>
          OptionsUtils.validate({
            ...allOptions,
            schemaPath: '/i_dont_exist/forestadminschema.json',
          }),
        ).toThrow(`options.schemaPath is invalid.`);
      });
    });

    describe.each([
      'agentUrl',
      'authSecret',
      'envSecret',
      'forestServerUrl',
      'prefix',
      'schemaPath',
    ])('%s', key => {
      test('should fail with null', () => {
        expect(() => OptionsUtils.validate({ ...allOptions, [key]: null })).toThrow(
          `options.${key} is invalid.`,
        );
      });
    });

    describe.each([
      'agentUrl',
      'authSecret',
      'clientId',
      'envSecret',
      'forestServerUrl',
      'prefix',
      'schemaPath',
    ])('%s', key => {
      test('should fail with number', () => {
        expect(() =>
          OptionsUtils.validate({ ...allOptions, [key]: 123 as unknown as string }),
        ).toThrow(`options.${key} is invalid.`);
      });
    });

    describe.each(['agentUrl', 'envSecret', 'forestServerUrl'])('%s', key => {
      test('should fail with bad format', () => {
        expect(() => OptionsUtils.validate({ ...allOptions, [key]: '123' })).toThrow(
          `options.${key} is invalid.`,
        );
      });
    });
  });
});
