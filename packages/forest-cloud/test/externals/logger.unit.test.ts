import createLogger, { loggerPrefix } from '../../src/externals/logger';

describe('logger', () => {
  describe('when log', () => {
    it('should log the message', () => {
      process.stdout.write = jest.fn();

      createLogger().log('message');
      expect(process.stdout.write).toHaveBeenCalledWith('message\n');
    });
  });

  describe('when info', () => {
    it('should log the message', () => {
      process.stdout.write = jest.fn();

      createLogger().info('message');
      expect(process.stdout.write).toHaveBeenCalledWith(`${loggerPrefix.Info} message\n`);
    });
  });

  describe('when error', () => {
    it('should log the message', () => {
      process.stdout.write = jest.fn();

      createLogger().error('message');
      expect(process.stdout.write).toHaveBeenCalledWith(`${loggerPrefix.Error} message\n`);
    });
  });

  describe('when warn', () => {
    it('should log the message', () => {
      process.stdout.write = jest.fn();

      createLogger().warn('message');
      expect(process.stdout.write).toHaveBeenCalledWith(`${loggerPrefix.Warn} message\n`);
    });
  });

  describe('when debug', () => {
    it('should log the message', () => {
      process.stdout.write = jest.fn();

      createLogger().debug('message');
      expect(process.stdout.write).toHaveBeenCalledWith(`${loggerPrefix.Debug} message\n`);
    });
  });

  describe('with prefix', () => {
    it('should log the message with the prefix', () => {
      process.stdout.write = jest.fn();

      createLogger().info('message', 'prefix');
      expect(process.stdout.write).toHaveBeenCalledWith(`prefix | ${loggerPrefix.Info} message\n`);
    });
  });
});
